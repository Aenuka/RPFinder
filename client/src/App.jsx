import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createGroup,
  deleteGroup,
  getGroupsByMemberItNumberWithAuth,
  getRequestsByRequesterItNumberWithAuth,
  getGroupsBySize,
  requestMemberDetail,
  requestEmailOtp,
  updateGroup,
  verifyEmailOtp,
  sendDetailRequestMessage,
  deleteDetailRequestChat,
} from './api/groupApi';
import sliitCrest from './assets/SLIIT_Logo_Crest.png';

import './App.css';

const TECH_STACKS = [
  'React',
  'Node.js',
  'MongoDB',
  'MySQL',
  'PostgreSQL',
  'TypeScript',
  'Python',
  'Django',
  'Flask',
  'Next.js',
  'Vue',
  'Angular',
  'Laravel',
  'Java',
  'C#',
  'AWS',
  'Docker',
];

const SPECIALIZATION_OPTIONS = [
  'Information Technology (General)',
  'Artificial Intelligence (AI)',
  'Software Engineering (SE)',
  'Data Science (DS)',
  'Cyber Security',
  'Computer Systems & Network Engineering',
  'Information Systems Engineering',
  'Interactive Media',
];

const createEmptyMember = () => ({
  fullName: '',
  itNumber: '',
  phoneNumber: '',
  email: '',
  gpa: '',
  githubUsername: '',
  specialization: 'Information Technology (General)',
  techStacks: [],
  internshipStatus: '',
  linkedin: '',
});

const createMembers = (count) => Array.from({ length: count }, createEmptyMember);

const normalizeMember = (member) => ({
  fullName: member.fullName.trim(),
  itNumber: member.itNumber.trim().toUpperCase(),
  phoneNumber: member.phoneNumber.trim(),
  email: member.email.trim().toLowerCase(),
  specialization: member.specialization,
  techStacks: member.techStacks,
  ...(member.gpa !== '' ? { gpa: Number(member.gpa) } : {}),
  ...(member.githubUsername.trim() ? { githubUsername: member.githubUsername.trim() } : {}),
  ...(member.internshipStatus ? { internshipStatus: member.internshipStatus } : {}),
  ...(member.linkedin.trim() ? { linkedin: member.linkedin.trim() } : {}),
});

const flattenGroups = (groupsBySize) => [1, 2, 3, 4].flatMap((size) => groupsBySize[size] || []);

const formatFieldLabel = (fieldName) => {
  const labels = {
    itNumberShared: 'IT Number',
    gpa: 'GPA',
    githubUsername: 'GitHub',
    linkedin: 'LinkedIn',
    internshipStatus: 'Internship Status',
  };

  return labels[fieldName] || fieldName;
};

const formatRequestedFields = (request) => {
  const fields = Array.isArray(request?.requestedFields) && request.requestedFields.length > 0
    ? request.requestedFields
    : request?.fieldName
      ? [request.fieldName]
      : [];

  if (!fields.length) {
    return 'details';
  }

  return fields.map((field) => formatFieldLabel(field)).join(', ');
};

function App() {
  const [hasStarted, setHasStarted] = useState(false);
  const [activeView, setActiveView] = useState('register');
  const [memberCount, setMemberCount] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({});
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [requesterItNumber, setRequesterItNumber] = useState('');
  const [requestNote, setRequestNote] = useState('');
  const [formData, setFormData] = useState({
    members: createMembers(1),
    expectedFromNewcomer: '',
    aboutCurrentMembers: '',
    reasonLeftPreviousGroup: '',
  });
  const [groupsBySize, setGroupsBySize] = useState({ 1: [], 2: [], 3: [], 4: [] });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [profileItNumber, setProfileItNumber] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileOtpCode, setProfileOtpCode] = useState('');
  const [profileAuthToken, setProfileAuthToken] = useState('');
  const [isProfileVerified, setIsProfileVerified] = useState(false);
  const [loggedInItNumber, setLoggedInItNumber] = useState('');
  const [loggedInUserName, setLoggedInUserName] = useState('');
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [profileGroups, setProfileGroups] = useState([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [savingGroupId, setSavingGroupId] = useState('');
  const [deletingGroupId, setDeletingGroupId] = useState('');
  const [requestingKey, setRequestingKey] = useState('');
  const [profileDrafts, setProfileDrafts] = useState({});
  const [requestMessageInputs, setRequestMessageInputs] = useState({});
  const [sendingMessageKey, setSendingMessageKey] = useState('');
  const [deletingChatKey, setDeletingChatKey] = useState('');
  const [selectedChatRequest, setSelectedChatRequest] = useState(null);
  const [chatNotice, setChatNotice] = useState('');
  const [requesterRequests, setRequesterRequests] = useState([]);
  const chatSnapshotRef = useRef({ initialized: false, map: {} });
  const requesterChatSnapshotRef = useRef({ initialized: false, map: {} });

  const helperText = useMemo(() => {
    if (memberCount === 4) {
      return '4-member group: system marks this as solid group - we stay as group forever.';
    }
    if (memberCount === 3 || memberCount === 2) {
      return `For ${memberCount} members, add newcomer expectations and a short intro about current members.`;
    }
    return 'For 1 member, add expectations from 2 or 3 members and why you left your previous group.';
  }, [memberCount]);

  const selectedGroup = useMemo(() => {
    if (!selectedGroupId) {
      return null;
    }

    return flattenGroups(groupsBySize).find((group) => group._id === selectedGroupId) || null;
  }, [groupsBySize, selectedGroupId]);

  const filteredGroupsBySize = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    const removeOwnGroups = (groups) => {
      if (!loggedInItNumber) {
        return groups;
      }
      return groups.filter(
        (group) => !group.members.some((member) => member.itNumber === loggedInItNumber)
      );
    };

    if (!query) {
      return {
        1: removeOwnGroups(groupsBySize[1] || []),
        2: removeOwnGroups(groupsBySize[2] || []),
        3: removeOwnGroups(groupsBySize[3] || []),
        4: removeOwnGroups(groupsBySize[4] || []),
      };
    }

    const matchesQuery = (member) => {
      return [member.fullName, member.phoneNumber, member.itNumber]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query));
    };

    return {
      1: removeOwnGroups((groupsBySize[1] || []).filter((group) => group.members.some(matchesQuery))),
      2: removeOwnGroups((groupsBySize[2] || []).filter((group) => group.members.some(matchesQuery))),
      3: removeOwnGroups((groupsBySize[3] || []).filter((group) => group.members.some(matchesQuery))),
      4: removeOwnGroups((groupsBySize[4] || []).filter((group) => group.members.some(matchesQuery))),
    };
  }, [groupsBySize, searchTerm, loggedInItNumber]);

  const pendingChatCount = useMemo(() => {
    if (!loggedInItNumber) {
      return 0;
    }

    return profileGroups.reduce((count, group) => {
      const relatedPendingCount = (group.detailRequests || []).filter(
        (request) =>
          !request.resolved &&
          (request.memberItNumber === loggedInItNumber || request.requesterItNumber === loggedInItNumber)
      ).length;
      return count + relatedPendingCount;
    }, 0);
  }, [profileGroups, loggedInItNumber]);

  const totalChatCount = pendingChatCount + requesterRequests.length;

  const detectChatActivity = (groups, options = {}) => {
    const { allowRedirect = false } = options;
    const nextMap = {};
    const relatedActivities = [];

    groups.forEach((group) => {
      (group.detailRequests || [])
        .filter((request) => !request.resolved)
        .forEach((request) => {
          const requestKey = `${group._id}-${request._id || `${request.memberItNumber}-${request.fieldName}-${request.requesterItNumber || 'NA'}`}`;
          const lastMessage = Array.isArray(request.messages) && request.messages.length > 0
            ? request.messages[request.messages.length - 1]
            : null;
          const signature = [
            request.createdAt || '',
            request.updatedAt || '',
            lastMessage?.createdAt || '',
            lastMessage?.content || '',
          ].join('|');

          nextMap[requestKey] = signature;

          if (
            loggedInItNumber &&
            (request.memberItNumber === loggedInItNumber || request.requesterItNumber === loggedInItNumber)
          ) {
            relatedActivities.push({
              requestKey,
              groupId: group._id,
              memberItNumber: request.memberItNumber,
              fieldName: request.fieldName,
              requesterItNumber: request.requesterItNumber || '',
              requesterName: request.requesterName || 'Anonymous',
            });
          }
        });
    });

    if (!chatSnapshotRef.current.initialized) {
      chatSnapshotRef.current = { initialized: true, map: nextMap };
      return;
    }

    const previousMap = chatSnapshotRef.current.map;
    const freshActivities = relatedActivities.filter(
      (activity) => previousMap[activity.requestKey] !== nextMap[activity.requestKey]
    );

    if (freshActivities.length > 0) {
      setChatNotice('You have chat activity. Opening chat now.');

      if (allowRedirect) {
        const target = freshActivities[0];
        setSelectedChatRequest({
          groupId: target.groupId,
          memberItNumber: target.memberItNumber,
          fieldName: target.fieldName,
          requesterItNumber: target.requesterItNumber,
          requesterName: target.requesterName,
        });
        setHasStarted(true);
        setActiveView('profile');
      }
    }

    chatSnapshotRef.current = { initialized: true, map: nextMap };
  };

  const detectRequesterChatActivity = (requests, options = {}) => {
    const { allowRedirect = false } = options;
    const nextMap = {};

    requests.forEach((request) => {
      const key = `${request.groupId}-${request.requestId}`;
      const lastMessage = Array.isArray(request.messages) && request.messages.length > 0
        ? request.messages[request.messages.length - 1]
        : null;
      nextMap[key] = [
        request.createdAt || '',
        request.updatedAt || '',
        lastMessage?.createdAt || '',
        lastMessage?.content || '',
      ].join('|');
    });

    if (!requesterChatSnapshotRef.current.initialized) {
      requesterChatSnapshotRef.current = { initialized: true, map: nextMap };
      return;
    }

    const previousMap = requesterChatSnapshotRef.current.map;
    const fresh = requests.filter((request) => {
      const key = `${request.groupId}-${request.requestId}`;
      return previousMap[key] !== nextMap[key];
    });

    if (fresh.length > 0) {
      setChatNotice('You have chat activity. Opening chat now.');
      if (allowRedirect) {
        const target = fresh[0];
        setSelectedGroupId(target.groupId);
        setSelectedChatRequest({
          groupId: target.groupId,
          memberItNumber: target.memberItNumber,
          fieldName: target.fieldName,
          requestId: target.requestId,
          requesterItNumber: target.requesterItNumber,
          requesterName: target.requesterName,
        });
        setHasStarted(true);
        setActiveView('details');
      }
    }

    requesterChatSnapshotRef.current = { initialized: true, map: nextMap };
  };

  const updateMemberField = (index, field, value) => {
    setFormData((prev) => {
      const nextMembers = [...prev.members];
      nextMembers[index] = { ...nextMembers[index], [field]: value };
      return { ...prev, members: nextMembers };
    });
  };

  const toggleTechStack = (index, techStack) => {
    setFormData((prev) => {
      const nextMembers = [...prev.members];
      const selected = new Set(nextMembers[index].techStacks);
      if (selected.has(techStack)) {
        selected.delete(techStack);
      } else {
        selected.add(techStack);
      }
      nextMembers[index] = {
        ...nextMembers[index],
        techStacks: Array.from(selected),
      };
      return { ...prev, members: nextMembers };
    });
  };

  const handleMemberCountChange = (nextCount) => {
    setMemberCount(nextCount);
    setFormData((prev) => {
      const resizedMembers = createMembers(nextCount).map((member, index) => prev.members[index] || member);
      return {
        ...prev,
        members: resizedMembers,
      };
    });
  };

  const startRegistration = (count) => {
    handleMemberCountChange(count);
    setActiveView('register');
    setHasStarted(true);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const openGroupLists = () => {
    setActiveView('list');
    setHasStarted(true);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const openProfile = () => {
    setActiveView('profile');
    setHasStarted(true);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const openDetailsPage = (groupId) => {
    const group = flattenGroups(groupsBySize).find((item) => item._id === groupId);
    const isOwnGroup =
      Boolean(loggedInItNumber) &&
      Boolean(group?.members?.some((member) => member.itNumber === loggedInItNumber));

    if (isOwnGroup) {
      setErrorMessage('Your own group is hidden from request flow. You cannot request your own group details.');
      setSuccessMessage('');
      return;
    }

    setSelectedGroupId(groupId);
    setActiveView('details');
    setHasStarted(true);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const fetchGroups = async () => {
    setIsLoadingGroups(true);
    setErrorMessage('');
    try {
      const [one, two, three, four] = await Promise.all([
        getGroupsBySize(1),
        getGroupsBySize(2),
        getGroupsBySize(3),
        getGroupsBySize(4),
      ]);
      setGroupsBySize({ 1: one, 2: two, 3: three, 4: four });
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Failed to fetch groups.');
    } finally {
      setIsLoadingGroups(false);
    }
  };


  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    if (!isProfileVerified || !profileAuthToken || !loggedInItNumber) {
      return;
    }

    let cancelled = false;

    const pollProfileChats = async () => {
      try {
        const [groupsResult, sentRequestsResult] = await Promise.allSettled([
          getGroupsByMemberItNumberWithAuth(loggedInItNumber, profileAuthToken),
          getRequestsByRequesterItNumberWithAuth(loggedInItNumber, profileAuthToken),
        ]);

        if (groupsResult.status !== 'fulfilled') {
          throw groupsResult.reason;
        }

        const groups = groupsResult.value;
        const sentRequests = sentRequestsResult.status === 'fulfilled' ? sentRequestsResult.value : [];
        if (cancelled) {
          return;
        }
        setProfileGroups(groups);
        setRequesterRequests(sentRequests);
        detectChatActivity(groups, { allowRedirect: true });
        detectRequesterChatActivity(sentRequests, { allowRedirect: true });
      } catch {
        // Silent polling retries on the next interval.
      }
    };

    pollProfileChats();
    const intervalId = setInterval(pollProfileChats, 5000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [isProfileVerified, profileAuthToken, loggedInItNumber]);

  // Handle scroll to selected chat when it changes
  useEffect(() => {
    if (selectedChatRequest && activeView === 'profile') {
      // Small delay to ensure DOM is updated
      const timer = setTimeout(() => {
        const groups = document.querySelectorAll('[data-group-id]');
        let found = false;
        
        groups.forEach((groupEl) => {
          if (found) return;
          const groupId = groupEl.getAttribute('data-group-id');
          
          if (groupId === selectedChatRequest.groupId) {
            const requests = groupEl.querySelectorAll('[data-request-key]');
            requests.forEach((requestEl) => {
              const requestId = requestEl.getAttribute('data-request-id');
              const memberIt = requestEl.getAttribute('data-member-it');
              if (
                (selectedChatRequest.requestId && requestId === selectedChatRequest.requestId) ||
                memberIt === selectedChatRequest.memberItNumber
              ) {
                requestEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                found = true;
              }
            });
          }
        });
        
        // Clear selection after scrolling
        setTimeout(() => setSelectedChatRequest(null), 1500);
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [selectedChatRequest, activeView]);

  useEffect(() => {
    if (selectedChatRequest && activeView === 'details') {
      const timer = setTimeout(() => {
        const requestId = selectedChatRequest.requestId;
        if (!requestId) {
          return;
        }
        const target = document.querySelector(`[data-requester-chat-key="${requestId}"]`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 250);

      return () => clearTimeout(timer);
    }
  }, [selectedChatRequest, activeView]);
  const normalizePayload = () => {
    const payload = {
      members: formData.members.map((member) => normalizeMember(member)),
    };

    if (memberCount === 2 || memberCount === 3) {
      payload.expectedFromNewcomer = formData.expectedFromNewcomer.trim();
      payload.aboutCurrentMembers = formData.aboutCurrentMembers.trim();
    }

    if (memberCount === 1) {
      payload.expectedFromNewcomer = formData.expectedFromNewcomer.trim();
      payload.reasonLeftPreviousGroup = formData.reasonLeftPreviousGroup.trim();
    }

    return payload;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await createGroup(normalizePayload());
      setSuccessMessage('Group registered successfully.');
      setFormData({
        members: createMembers(memberCount),
        expectedFromNewcomer: '',
        aboutCurrentMembers: '',
        reasonLeftPreviousGroup: '',
      });
      await fetchGroups();
      setActiveView('list');
    } catch (error) {
      const details = error?.response?.data?.details;
      const serverMessage = error?.response?.data?.message;
      if (Array.isArray(details) && details.length > 0) {
        setErrorMessage(details.join(' | '));
      } else {
        setErrorMessage(serverMessage || 'Failed to register group.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleGroupDetails = (groupId) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const loadProfileGroups = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    const normalized = profileItNumber.trim().toUpperCase();
    if (!/^IT\d{8}$/.test(normalized)) {
      setErrorMessage('Enter valid IT number in ITXXXXXXXX format.');
      return;
    }

    if (!isProfileVerified || !profileAuthToken) {
      setErrorMessage('Verify your profile with email OTP first.');
      return;
    }

    setIsLoadingProfile(true);
    setProfileGroups([]);
    try {
      const [groupsResult, sentRequestsResult] = await Promise.allSettled([
        getGroupsByMemberItNumberWithAuth(normalized, profileAuthToken),
        getRequestsByRequesterItNumberWithAuth(normalized, profileAuthToken),
      ]);

      if (groupsResult.status !== 'fulfilled') {
        throw groupsResult.reason;
      }

      const groups = groupsResult.value;
      const sentRequests = sentRequestsResult.status === 'fulfilled' ? sentRequestsResult.value : [];
      setProfileGroups(groups);
      setRequesterRequests(sentRequests);
      detectChatActivity(groups, { allowRedirect: false });
      detectRequesterChatActivity(sentRequests, { allowRedirect: false });
      setProfileDrafts(
        groups.reduce((acc, group) => {
          acc[group._id] = {
            expectedFromNewcomer: group.expectedFromNewcomer || '',
            aboutCurrentMembers: group.aboutCurrentMembers || '',
            reasonLeftPreviousGroup: group.reasonLeftPreviousGroup || '',
            members: group.members.map((member) => ({
              gpa: member.gpa ?? '',
              githubUsername: member.githubUsername || '',
              linkedin: member.linkedin || '',
              internshipStatus: member.internshipStatus || '',
            })),
          };
          return acc;
        }, {})
      );
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Failed to load your registered groups.');
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleProfileDraftChange = (groupId, field, value) => {
    setProfileDrafts((prev) => ({
      ...prev,
      [groupId]: {
        ...prev[groupId],
        [field]: value,
      },
    }));
  };

  const handleProfileMemberOptionalChange = (groupId, memberIndex, field, value) => {
    setProfileDrafts((prev) => {
      const groupDraft = prev[groupId] || { members: [] };
      const nextMembers = [...(groupDraft.members || [])];
      nextMembers[memberIndex] = {
        ...(nextMembers[memberIndex] || {}),
        [field]: value,
      };

      return {
        ...prev,
        [groupId]: {
          ...groupDraft,
          members: nextMembers,
        },
      };
    });
  };

  const saveProfileGroup = async (group) => {
    setSavingGroupId(group._id);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const draft = profileDrafts[group._id] || {};
      const mergedMembers = group.members.map((member, index) => {
        const memberDraft = draft.members?.[index] || {};
        return {
          ...member,
          ...(memberDraft.gpa !== '' ? { gpa: Number(memberDraft.gpa) } : { gpa: undefined }),
          ...(memberDraft.githubUsername?.trim()
            ? { githubUsername: memberDraft.githubUsername.trim() }
            : { githubUsername: undefined }),
          ...(memberDraft.linkedin?.trim() ? { linkedin: memberDraft.linkedin.trim() } : { linkedin: undefined }),
          ...(memberDraft.internshipStatus ? { internshipStatus: memberDraft.internshipStatus } : { internshipStatus: undefined }),
        };
      });

      await updateGroup(group._id, {
        members: mergedMembers,
        expectedFromNewcomer: draft.expectedFromNewcomer || '',
        aboutCurrentMembers: draft.aboutCurrentMembers || '',
        reasonLeftPreviousGroup: draft.reasonLeftPreviousGroup || '',
      }, profileAuthToken);
      setSuccessMessage('Group updated successfully.');
      await Promise.all([fetchGroups(), loadProfileGroups()]);
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Failed to update group.');
    } finally {
      setSavingGroupId('');
    }
  };

  const removeProfileGroup = async (groupId) => {
    setDeletingGroupId(groupId);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await deleteGroup(groupId, profileAuthToken);
      setSuccessMessage('Group deleted successfully.');
      await Promise.all([fetchGroups(), loadProfileGroups()]);
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Failed to delete group.');
    } finally {
      setDeletingGroupId('');
    }
  };

  const submitDetailRequest = async (groupId, memberItNumber, fieldName) => {
    if (!isProfileVerified) {
      setErrorMessage('You must be logged in to request details. Please verify with OTP in the Profile section.');
      setHasStarted(true);
      setActiveView('profile');
      return;
    }

    const normalizedRequesterName = requesterName.trim();

    if (!normalizedRequesterName) {
      setErrorMessage('Requester name is required to send a detail request.');
      setSuccessMessage('');
      return;
    }

    if (loggedInItNumber && memberItNumber === loggedInItNumber) {
      setErrorMessage('You cannot request details from yourself.');
      setSuccessMessage('');
      return;
    }

    const targetGroup = flattenGroups(groupsBySize).find((group) => group._id === groupId);
    const isOwnGroup =
      Boolean(loggedInItNumber) &&
      Boolean(targetGroup?.members?.some((member) => member.itNumber === loggedInItNumber));

    if (isOwnGroup) {
      setErrorMessage('You cannot request details from your own registered group.');
      setSuccessMessage('');
      return;
    }

    const key = `${groupId}-${memberItNumber}-${fieldName}`;
    setRequestingKey(key);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await requestMemberDetail(groupId, {
        memberItNumber,
        fieldName,
        requesterName: normalizedRequesterName,
        requesterItNumber: loggedInItNumber || requesterItNumber.trim().toUpperCase(),
        note: requestNote.trim(),
      });

      
      // Refresh groups first to get the new request data
      await fetchGroups();
      
      // Track the request we just sent for immediate chat display
      const normalizedRequesterIt = loggedInItNumber || requesterItNumber.trim().toUpperCase();
      const activeRequest = response?.request;
      setSelectedChatRequest({
        groupId,
        memberItNumber: activeRequest?.memberItNumber || memberItNumber,
        fieldName: activeRequest?.fieldName || fieldName,
        requestId: activeRequest?._id || activeRequest?.requestId,
        requesterItNumber: normalizedRequesterIt,
        requesterName: normalizedRequesterName,
      });
      
      // Redirect requester directly to details chat window
      setHasStarted(true);
      setSelectedGroupId(groupId);
      setActiveView('details');
      // Clear the request inputs
      setRequesterName('');
      setRequesterItNumber('');
      setRequestNote('');
    } catch (error) {
      if (error?.response?.data?.code === 'NOT_REGISTERED') {
        setErrorMessage(
          'You must register at least one group before requesting details. Please register a group first.'
        );
        setHasStarted(true);
        setActiveView('register');
      } else {
        setErrorMessage(error?.response?.data?.message || 'Failed to submit request.');
      }
    } finally {
      setRequestingKey('');
    }
  };

  const sendRequestMessage = async (groupId, requestId) => {
    const messageKey = `${groupId}-${requestId}`;
    const content = (requestMessageInputs[messageKey] || '').trim();

    if (!content) {
      return;
    }

    setSendingMessageKey(messageKey);
    try {
      const normalizedSenderName =
        requesterName.trim() ||
        loggedInUserName ||
        loggedInItNumber ||
        profileItNumber ||
        'Member';

      await sendDetailRequestMessage(groupId, requestId, {
        senderItNumber: loggedInItNumber || profileItNumber || '',
        senderName: normalizedSenderName,
        content,
      });

      setRequestMessageInputs((prev) => ({ ...prev, [messageKey]: '' }));
      await loadProfileGroups();
      setSuccessMessage('Message sent!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Failed to send message.');
    } finally {
      setSendingMessageKey('');
    }
  };

  const deleteChatWindow = async (groupId, requestId) => {
    if (!isProfileVerified || !profileAuthToken) {
      setErrorMessage('Please login with OTP to delete chat windows.');
      return;
    }

    const chatKey = `${groupId}-${requestId}`;
    setDeletingChatKey(chatKey);
    setErrorMessage('');

    try {
      await deleteDetailRequestChat(groupId, requestId, profileAuthToken);
      setRequestMessageInputs((prev) => {
        const next = { ...prev };
        delete next[chatKey];
        return next;
      });
      if (selectedChatRequest?.requestId === requestId) {
        setSelectedChatRequest(null);
      }
      await loadProfileGroups();
      await fetchGroups();
      setSuccessMessage('Chat window deleted.');
      setTimeout(() => setSuccessMessage(''), 2500);
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Failed to delete chat window.');
    } finally {
      setDeletingChatKey('');
    }
  };

  const requestProfileOtp = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    const normalizedIt = profileItNumber.trim().toUpperCase();
    const normalizedEmail = profileEmail.trim().toLowerCase();

    if (!/^IT\d{8}$/.test(normalizedIt)) {
      setErrorMessage('Enter valid IT number in ITXXXXXXXX format.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setErrorMessage('Enter a valid email address.');
      return;
    }

    setIsRequestingOtp(true);
    try {
      const response = await requestEmailOtp({
        itNumber: normalizedIt,
        email: normalizedEmail,
      });
      setSuccessMessage(response.message || 'Email OTP sent.');
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Failed to send OTP.');
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const verifyProfileOtp = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    const normalizedIt = profileItNumber.trim().toUpperCase();
    const normalizedEmail = profileEmail.trim().toLowerCase();

    if (!profileOtpCode.trim()) {
      setErrorMessage('Enter the OTP code from email.');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const response = await verifyEmailOtp({
        itNumber: normalizedIt,
        email: normalizedEmail,
        otpCode: profileOtpCode.trim(),
      });

      setProfileAuthToken(response.token || '');
      setIsProfileVerified(true);
      setLoggedInItNumber(normalizedIt);
      setLoggedInUserName(normalizedIt);
      setSuccessMessage('You are now logged in. You can request details and manage your groups.');
    } catch (error) {
      setIsProfileVerified(false);
      setProfileAuthToken('');
      setLoggedInItNumber('');
      setLoggedInUserName('');
      setErrorMessage(error?.response?.data?.message || 'OTP verification failed.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const logout = () => {
    setProfileAuthToken('');
    setIsProfileVerified(false);
    setLoggedInItNumber('');
    setLoggedInUserName('');
    setProfileItNumber('');
    setProfileEmail('');
    setProfileOtpCode('');
    setProfileGroups([]);
    setRequesterRequests([]);
    setProfileDrafts({});
    setChatNotice('');
    setSelectedChatRequest(null);
    chatSnapshotRef.current = { initialized: false, map: {} };
    requesterChatSnapshotRef.current = { initialized: false, map: {} };
    setActiveView('list');
    setSuccessMessage('You have been logged out.');
  };

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-brand">
          <div className="hero-logo-wrap" aria-hidden="true">
            <img src={sliitCrest} alt="" className="hero-logo" />
          </div>
          <div>
            <p className="eyebrow">SLIIT | RP Finder</p>
            <h1>Research Group Member Finder</h1>
            <p>Simple list first, full details on demand, and profile-based group management.</p>
          </div>
        </div>
      </header>

      {!hasStarted ? (
        <section className="panel start-panel">
          <h2>Select member count to start registration</h2>
          <p>Choose your current group size, then continue to register.</p>
          <div className="start-buttons">
            {[1, 2, 3, 4].map((count) => (
              <button
                key={`start-${count}`}
                type="button"
                className="start-btn"
                onClick={() => startRegistration(count)}
              >
                {count} Member{count > 1 ? 's' : ''}
              </button>
            ))}
          </div>
          <div className="start-row">
            <button type="button" className="start-list-btn" onClick={openGroupLists}>
              Open All Group Lists
            </button>
            <button type="button" className="start-list-btn" onClick={openProfile}>
              Manage My Groups
            </button>
          </div>
        </section>
      ) : null}

      {hasStarted ? (
        <>
          <nav className="view-switch">
            <button type="button" className={activeView === 'register' ? 'active' : ''} onClick={() => setActiveView('register')}>
              Register Group
            </button>
            <button type="button" className={activeView === 'list' ? 'active' : ''} onClick={() => setActiveView('list')}>
              All Group Lists
            </button>
            <button type="button" className={activeView === 'details' ? 'active' : ''} onClick={() => setActiveView('details')}>
              Group Details
            </button>
            <button type="button" className={activeView === 'profile' ? 'active' : ''} onClick={() => setActiveView('profile')}>
              My Profile {totalChatCount > 0 ? `(${totalChatCount})` : ''}
            </button>
          </nav>
          {isProfileVerified && loggedInItNumber ? (
            <div className="login-status">
              <span>📌 Logged in as: {loggedInItNumber}</span>
              <button type="button" className="logout-btn" onClick={logout}>
                Logout
              </button>
            </div>
          ) : null}
          {isProfileVerified && chatNotice ? (
            <div className="chat-notice">
              <span>{chatNotice}</span>
              <div className="chat-notice-actions">
                <button type="button" onClick={() => setActiveView('profile')}>
                  Open Chat
                </button>
                <button type="button" className="ghost-btn" onClick={() => setChatNotice('')}>
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {errorMessage ? <p className="alert error">{errorMessage}</p> : null}
      {successMessage ? <p className="alert success">{successMessage}</p> : null}

      {hasStarted && activeView === 'register' ? (
        <section className="panel">
          <h2>Register as 1, 2, 3 or 4 members</h2>
          <form onSubmit={handleSubmit} className="register-form">
            <label>
              Number of Members
              <select value={memberCount} onChange={(event) => handleMemberCountChange(Number(event.target.value))}>
                <option value={1}>1 Member</option>
                <option value={2}>2 Members</option>
                <option value={3}>3 Members</option>
                <option value={4}>4 Members</option>
              </select>
            </label>

            <p className="helper">{helperText}</p>

            {formData.members.map((member, index) => (
              <article className="member-card" key={`member-${index + 1}`}>
                <h3>Member {index + 1}</h3>
                <div className="grid">
                  <label>
                    Full Name
                    <input type="text" value={member.fullName} onChange={(event) => updateMemberField(index, 'fullName', event.target.value)} required />
                  </label>
                  <label>
                    IT Number (ITXXXXXXXX)
                    <input type="text" value={member.itNumber} onChange={(event) => updateMemberField(index, 'itNumber', event.target.value)} pattern="IT[0-9]{8}" required />
                  </label>
                  <label>
                    Phone Number
                    <input type="text" value={member.phoneNumber} onChange={(event) => updateMemberField(index, 'phoneNumber', event.target.value)} required />
                  </label>
                  <label>
                    Email
                    <input type="email" value={member.email} onChange={(event) => updateMemberField(index, 'email', event.target.value)} required />
                  </label>
                  <label>
                    GPA (Optional)
                    <input type="number" value={member.gpa} onChange={(event) => updateMemberField(index, 'gpa', event.target.value)} step="0.01" min="0" max="4" />
                  </label>
                  <label>
                    GitHub Username (Optional)
                    <input type="text" value={member.githubUsername} onChange={(event) => updateMemberField(index, 'githubUsername', event.target.value)} />
                  </label>
                  <label>
                    Specialization Details
                    <select
                      value={member.specialization}
                      onChange={(event) => updateMemberField(index, 'specialization', event.target.value)}
                      required
                    >
                      {SPECIALIZATION_OPTIONS.map((specialization) => (
                        <option key={`${index}-specialization-${specialization}`} value={specialization}>
                          {specialization}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Internship Status (Optional)
                    <select value={member.internshipStatus} onChange={(event) => updateMemberField(index, 'internshipStatus', event.target.value)}>
                      <option value="">Not specified</option>
                      <option value="doing intern">Doing Intern</option>
                      <option value="finished">Finished</option>
                      <option value="not yet">Not Yet</option>
                    </select>
                  </label>
                  <label>
                    LinkedIn (Optional)
                    <input type="url" value={member.linkedin} onChange={(event) => updateMemberField(index, 'linkedin', event.target.value)} />
                  </label>
                </div>

                <fieldset className="tech-stacks">
                  <legend>Tech Stack Expertise (select at least one)</legend>
                  <div className="stack-grid">
                    {TECH_STACKS.map((stack) => (
                      <label key={`${index}-${stack}`} className="checkbox-pill">
                        <input type="checkbox" checked={member.techStacks.includes(stack)} onChange={() => toggleTechStack(index, stack)} />
                        <span>{stack}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </article>
            ))}

            {(memberCount === 2 || memberCount === 3) && (
              <div className="group-note">
                <label>
                  What do you expect from newcomer?
                  <textarea value={formData.expectedFromNewcomer} onChange={(event) => setFormData((prev) => ({ ...prev, expectedFromNewcomer: event.target.value }))} required />
                </label>
                <label>
                  Tell about the current members
                  <textarea value={formData.aboutCurrentMembers} onChange={(event) => setFormData((prev) => ({ ...prev, aboutCurrentMembers: event.target.value }))} required />
                </label>
              </div>
            )}

            {memberCount === 1 && (
              <div className="group-note">
                <label>
                  What do you expect from other 2 or 3 members?
                  <textarea value={formData.expectedFromNewcomer} onChange={(event) => setFormData((prev) => ({ ...prev, expectedFromNewcomer: event.target.value }))} required />
                </label>
                <label>
                  Why did you leave your previous group?
                  <textarea value={formData.reasonLeftPreviousGroup} onChange={(event) => setFormData((prev) => ({ ...prev, reasonLeftPreviousGroup: event.target.value }))} required />
                </label>
              </div>
            )}

            <button type="submit" className="submit-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Register Group'}
            </button>
          </form>
        </section>
      ) : null}

      {hasStarted && activeView === 'list' ? (
        <section className="panel">
          <div className="list-header">
            <h2>All Groups</h2>
            <div className="list-actions">
              <input
                type="text"
                placeholder="Search by name, phone or IT number"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              <button type="button" onClick={fetchGroups} disabled={isLoadingGroups}>
                {isLoadingGroups ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          <div className="lists">
            {[1, 2, 3, 4].map((size) => (
              <div className="list-block" key={`size-${size}`}>
                <h3>{size} Member List</h3>
                {filteredGroupsBySize[size]?.length ? (
                  filteredGroupsBySize[size].map((group) => {
                    const expanded = Boolean(expandedGroups[group._id]);
                    return (
                      <article className="group-card" key={group._id}>
                        <p className="status">{group.groupStatus}</p>
                        <p className="summary-line">Members: {group.members.map((m) => m.fullName).join(', ')}</p>
                        <p className="summary-line">
                          Specializations: {group.members
                            .map((m) => `${m.fullName}: ${m.specialization || 'Not provided'}`)
                            .join(' | ')}
                        </p>
                        <button type="button" className="ghost-btn" onClick={() => openDetailsPage(group._id)}>
                            View More Details
                        </button>
                          {expanded ? null : null}
                      </article>
                    );
                  })
                ) : (
                  <p className="empty">No matching groups found.</p>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {hasStarted && activeView === 'details' ? (
        <section className="panel">
          <div className="list-header">
            <h2>Group Details</h2>
            <button type="button" onClick={() => setActiveView('list')}>Back to List</button>
          </div>

          {selectedGroup ? (
            <article className="group-card details-page-card">
              <h3>Basic Group Information</h3>
              <p className="status">{selectedGroup.groupStatus}</p>
              <p>
                <strong>Group Size:</strong> {selectedGroup.members?.length || 0} members
              </p>
              {selectedGroup.expectedFromNewcomer ? (
                <p>
                  <strong>Expectations:</strong> {selectedGroup.expectedFromNewcomer}
                </p>
              ) : null}
              {selectedGroup.aboutCurrentMembers ? (
                <p>
                  <strong>About members:</strong> {selectedGroup.aboutCurrentMembers}
                </p>
              ) : null}
              {selectedGroup.reasonLeftPreviousGroup ? (
                <p>
                  <strong>Reason left previous group:</strong> {selectedGroup.reasonLeftPreviousGroup}
                </p>
              ) : null}
              <h3>Member Information</h3>
              <ul>
                {selectedGroup.members.map((member) => (
                  <li key={`${selectedGroup._id}-detail-${member.itNumber}`}>
                    <strong>{member.fullName}</strong> - {member.phoneNumber}
                    <div className="details-wrap">
                      <p>
                        IT Number: {member.itNumberShared || 'Not posted'}
                        <button
                          type="button"
                          className="ghost-btn inline-btn"
                          onClick={() => submitDetailRequest(selectedGroup._id, member.itNumber, 'itNumberShared')}
                          disabled={requestingKey === `${selectedGroup._id}-${member.itNumber}-itNumberShared`}
                        >
                          {requestingKey === `${selectedGroup._id}-${member.itNumber}-itNumberShared` ? 'Requesting...' : 'Request IT'}
                        </button>
                      </p>
                      <p>
                        GPA: {member.gpa ?? 'Not posted'}
                        <button
                          type="button"
                          className="ghost-btn inline-btn"
                          onClick={() => submitDetailRequest(selectedGroup._id, member.itNumber, 'gpa')}
                          disabled={requestingKey === `${selectedGroup._id}-${member.itNumber}-gpa`}
                        >
                          {requestingKey === `${selectedGroup._id}-${member.itNumber}-gpa` ? 'Requesting...' : 'Request GPA'}
                        </button>
                      </p>
                      <p>
                        GitHub: {member.githubUsername || 'Not posted'}
                        <button
                          type="button"
                          className="ghost-btn inline-btn"
                          onClick={() => submitDetailRequest(selectedGroup._id, member.itNumber, 'githubUsername')}
                          disabled={requestingKey === `${selectedGroup._id}-${member.itNumber}-githubUsername`}
                        >
                          {requestingKey === `${selectedGroup._id}-${member.itNumber}-githubUsername` ? 'Requesting...' : 'Request GitHub'}
                        </button>
                      </p>
                      <p>
                        LinkedIn: {member.linkedin || 'Not posted'}
                        <button
                          type="button"
                          className="ghost-btn inline-btn"
                          onClick={() => submitDetailRequest(selectedGroup._id, member.itNumber, 'linkedin')}
                          disabled={requestingKey === `${selectedGroup._id}-${member.itNumber}-linkedin`}
                        >
                          {requestingKey === `${selectedGroup._id}-${member.itNumber}-linkedin` ? 'Requesting...' : 'Request LinkedIn'}
                        </button>
                      </p>
                      <p>
                        Internship: {member.internshipStatus || 'Not posted'}
                        <button
                          type="button"
                          className="ghost-btn inline-btn"
                          onClick={() => submitDetailRequest(selectedGroup._id, member.itNumber, 'internshipStatus')}
                          disabled={requestingKey === `${selectedGroup._id}-${member.itNumber}-internshipStatus`}
                        >
                          {requestingKey === `${selectedGroup._id}-${member.itNumber}-internshipStatus` ? 'Requesting...' : 'Request Internship'}
                        </button>
                      </p>
                      <p>Stacks: {member.techStacks?.length ? member.techStacks.join(', ') : 'Not posted'}</p>
                    </div>
                  </li>
                ))}
              </ul>

              {isProfileVerified ? (
                <div className="requester-chat-section">
                  <h3>Your Live Chats For This Group</h3>
                  {requesterRequests.filter((request) => request.groupId === selectedGroup._id).length ? (
                    <div className="requests-container">
                      {requesterRequests
                        .filter((request) => request.groupId === selectedGroup._id)
                        .reduce((acc, request) => {
                          const existing = acc.find((item) => item.memberItNumber === request.memberItNumber);
                          if (!existing) {
                            acc.push({
                              ...request,
                              requestedFields: Array.isArray(request.requestedFields)
                                ? [...request.requestedFields]
                                : request.fieldName
                                  ? [request.fieldName]
                                  : [],
                              messages: Array.isArray(request.messages) ? [...request.messages] : [],
                            });
                            return acc;
                          }

                          existing.requestedFields = Array.from(
                            new Set([
                              ...(existing.requestedFields || []),
                              ...(Array.isArray(request.requestedFields)
                                ? request.requestedFields
                                : request.fieldName
                                  ? [request.fieldName]
                                  : []),
                            ])
                          );
                          existing.messages = [...(existing.messages || []), ...(request.messages || [])]
                            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

                          if (new Date(request.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
                            existing.updatedAt = request.updatedAt;
                            existing.requestId = request.requestId;
                          }

                          if (!existing.note && request.note) {
                            existing.note = request.note;
                          }

                          return acc;
                        }, [])
                        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                        .map((request) => {
                          const messageKey = `${request.groupId}-${request.requestId}`;
                          const isSelectedRequesterChat =
                            selectedChatRequest?.requestId === request.requestId;

                          return (
                            <div
                              key={request.requestId}
                              className={`request-card ${isSelectedRequesterChat ? 'selected-chat-request' : ''}`}
                              data-requester-chat-key={request.requestId}
                            >
                              <div className="request-header">
                                <strong>Live chat</strong> with group member
                              </div>
                              {request.note ? (
                                <p className="request-note">
                                  <em>Note:</em> {request.note}
                                </p>
                              ) : null}

                              <div className="request-chat">
                                <div className="chat-title-row">
                                  <h5>💬 Live Chat</h5>
                                  <button
                                    type="button"
                                    className="delete-chat-btn"
                                    onClick={() => deleteChatWindow(request.groupId, request.requestId)}
                                    disabled={deletingChatKey === messageKey}
                                  >
                                    {deletingChatKey === messageKey ? 'Deleting...' : 'Delete Chat'}
                                  </button>
                                </div>
                                <div className="chat-messages">
                                  {request.messages && request.messages.length > 0 ? (
                                    request.messages.map((msg, idx) => {
                                      const isOwnMessage =
                                        Boolean(loggedInItNumber) &&
                                        msg.senderItNumber === loggedInItNumber;

                                      return (
                                        <div
                                          key={`${request.requestId}-msg-${idx}`}
                                          className={`chat-message ${isOwnMessage ? 'own' : 'other'}`}
                                        >
                                          <strong>{isOwnMessage ? 'You' : (msg.senderName && msg.senderName !== 'You' ? msg.senderName : 'Other party')}</strong>
                                          <p>{msg.content}</p>
                                          <small>{new Date(msg.createdAt).toLocaleTimeString()}</small>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <p className="chat-empty">No messages yet. Start the conversation!</p>
                                  )}
                                </div>
                                <div className="chat-input-area">
                                  <input
                                    type="text"
                                    placeholder="Send a message..."
                                    value={requestMessageInputs[messageKey] || ''}
                                    onChange={(event) =>
                                      setRequestMessageInputs((prev) => ({ ...prev, [messageKey]: event.target.value }))
                                    }
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter') {
                                        sendRequestMessage(request.groupId, request.requestId);
                                      }
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className="send-msg-btn"
                                    onClick={() => sendRequestMessage(request.groupId, request.requestId)}
                                    disabled={sendingMessageKey === messageKey}
                                  >
                                    {sendingMessageKey === messageKey ? 'Sending...' : 'Send'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="empty">No live chats for this group yet.</p>
                  )}
                </div>
              ) : null}

              <div className="request-box">
                <h3>Request Missing Optional Details</h3>
                <p>Use buttons above to request details from members. This request section is kept at the bottom for better flow.</p>
                {!isProfileVerified ? (
                  <div className="login-reminder">
                    <strong>🔐 Login Required</strong>
                    <p>You must verify with OTP in the Profile section to request details. Go to <strong>My Profile</strong> and verify to get access.</p>
                  </div>
                ) : null}
                <label>
                  Your Name (for notification)
                  <input
                    type="text"
                    placeholder="Your name"
                    value={requesterName}
                    onChange={(event) => setRequesterName(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Your IT Number (for notification)
                  <input
                    type="text"
                    placeholder="ITXXXXXXXX"
                    value={requesterItNumber}
                    onChange={(event) => setRequesterItNumber(event.target.value.toUpperCase())}
                  />
                </label>
                <label>
                  Request Note (Optional)
                  <textarea
                    value={requestNote}
                    onChange={(event) => setRequestNote(event.target.value)}
                    placeholder="Add a note for your request"
                  />
                </label>
              </div>
            </article>
          ) : (
            <p className="empty">Select a group from All Group Lists to view details.</p>
          )}
        </section>
      ) : null}

      {hasStarted && activeView === 'profile' ? (
        <section className="panel">
          <h2>My Profile - Manage Registered Groups</h2>
          <p>Verify with email OTP first, then manage your registered groups securely.</p>
          <div className="list-actions">
            <input
              type="text"
              placeholder="ITXXXXXXXX"
              value={profileItNumber}
              onChange={(event) => setProfileItNumber(event.target.value.toUpperCase())}
            />
            <input
              type="email"
              placeholder="Your registered email"
              value={profileEmail}
              onChange={(event) => setProfileEmail(event.target.value)}
            />
            <button type="button" onClick={requestProfileOtp} disabled={isRequestingOtp}>
              {isRequestingOtp ? 'Sending OTP...' : 'Send Email OTP'}
            </button>
          </div>
          <div className="list-actions">
            <input
              type="text"
              placeholder="Enter OTP code"
              value={profileOtpCode}
              onChange={(event) => setProfileOtpCode(event.target.value)}
            />
            <button type="button" onClick={verifyProfileOtp} disabled={isVerifyingOtp}>
              {isVerifyingOtp ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button type="button" onClick={loadProfileGroups} disabled={isLoadingProfile || !isProfileVerified}>
              {isLoadingProfile ? 'Loading...' : 'Load My Groups'}
            </button>
          </div>
          <p className="helper">Verification status: {isProfileVerified ? 'Verified' : 'Not verified'}</p>

          <div className="profile-groups">
            {profileGroups.length ? (
              profileGroups.map((group) => {
                const draft = profileDrafts[group._id] || {
                  expectedFromNewcomer: '',
                  aboutCurrentMembers: '',
                  reasonLeftPreviousGroup: '',
                };
                return (
                  <article className="group-card" key={`profile-${group._id}`} data-group-id={group._id}>
                    <p className="status">{group.groupStatus}</p>
                    <p className="summary-line">Members: {group.members.map((m) => m.fullName).join(', ')}</p>
                    <div className="group-note">
                      <label>
                        Expected from newcomer
                        <textarea
                          value={draft.expectedFromNewcomer}
                          onChange={(event) => handleProfileDraftChange(group._id, 'expectedFromNewcomer', event.target.value)}
                        />
                      </label>
                      <label>
                        About current members
                        <textarea
                          value={draft.aboutCurrentMembers}
                          onChange={(event) => handleProfileDraftChange(group._id, 'aboutCurrentMembers', event.target.value)}
                        />
                      </label>
                      <label>
                        Reason left previous group
                        <textarea
                          value={draft.reasonLeftPreviousGroup}
                          onChange={(event) => handleProfileDraftChange(group._id, 'reasonLeftPreviousGroup', event.target.value)}
                        />
                      </label>
                    </div>

                    <h4>Optional Member Details</h4>
                    <div className="optional-grid">
                      {group.members.map((member, memberIndex) => {
                        const memberDraft = draft.members?.[memberIndex] || {};
                        return (
                          <div className="member-optional-card" key={`${group._id}-optional-${member.itNumber}`}>
                            <p>
                              <strong>{member.fullName}</strong>
                            </p>
                            <label>
                              IT Number (to share)
                              <input
                                type="text"
                                value={memberDraft.itNumberShared || ''}
                                onChange={(event) =>
                                  handleProfileMemberOptionalChange(group._id, memberIndex, 'itNumberShared', event.target.value)
                                }
                              />
                            </label>
                            <label>
                              GPA
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="4"
                                value={memberDraft.gpa ?? ''}
                                onChange={(event) =>
                                  handleProfileMemberOptionalChange(group._id, memberIndex, 'gpa', event.target.value)
                                }
                              />
                            </label>
                            <label>
                              GitHub Username
                              <input
                                type="text"
                                value={memberDraft.githubUsername || ''}
                                onChange={(event) =>
                                  handleProfileMemberOptionalChange(group._id, memberIndex, 'githubUsername', event.target.value)
                                }
                              />
                            </label>
                            <label>
                              LinkedIn
                              <input
                                type="text"
                                value={memberDraft.linkedin || ''}
                                onChange={(event) =>
                                  handleProfileMemberOptionalChange(group._id, memberIndex, 'linkedin', event.target.value)
                                }
                              />
                            </label>
                            <label>
                              Internship Status
                              <select
                                value={memberDraft.internshipStatus || ''}
                                onChange={(event) =>
                                  handleProfileMemberOptionalChange(group._id, memberIndex, 'internshipStatus', event.target.value)
                                }
                              >
                                <option value="">Not posted</option>
                                <option value="doing intern">Doing Intern</option>
                                <option value="finished">Finished</option>
                                <option value="not yet">Not Yet</option>
                              </select>
                            </label>
                          </div>
                        );
                      })}
                    </div>

                    <h4>Requested Optional Details</h4>
                    {group.detailRequests?.some((request) => !request.resolved) ? (
                      <div className="requests-container">
                        {group.detailRequests
                          .filter((request) => !request.resolved)
                          .map((request) => {
                            const messageKey = `${group._id}-${request._id}`;
                            const isSelectedChat = selectedChatRequest &&
                              selectedChatRequest.groupId === group._id &&
                              (
                                selectedChatRequest.requestId === request._id?.toString() ||
                                selectedChatRequest.memberItNumber === request.memberItNumber
                              );
                            
                            return (
                              <div
                                key={request._id || `${group._id}-${request.memberItNumber}-${request.fieldName}`}
                                className={`request-card ${isSelectedChat ? 'selected-chat-request' : ''}`}
                                data-request-key={messageKey}
                                data-request-id={request._id?.toString() || ''}
                                data-member-it={request.memberItNumber}
                                data-field-name={request.fieldName}
                              >
                                <div className="request-header">
                                  <strong>
                                    {request.requesterName || 'Anonymous'}
                                  </strong>
                                    {' '} started a live chat with you
                                </div>
                                {request.note ? (
                                  <p className="request-note">
                                    <em>Note:</em> {request.note}
                                  </p>
                                ) : null}
                                <p className="request-hint">👉 Use this chat to communicate and share details safely.</p>

                                <div className="request-chat">
                                  <div className="chat-title-row">
                                    <h5>💬 Live Chat</h5>
                                    <button
                                      type="button"
                                      className="delete-chat-btn"
                                      onClick={() => deleteChatWindow(group._id, request._id)}
                                      disabled={deletingChatKey === messageKey}
                                    >
                                      {deletingChatKey === messageKey ? 'Deleting...' : 'Delete Chat'}
                                    </button>
                                  </div>
                                  <div className="chat-messages">
                                    {request.messages && request.messages.length > 0 ? (
                                      request.messages.map((msg, idx) => {
                                        const isOwnMessage =
                                          Boolean(loggedInItNumber) &&
                                          msg.senderItNumber === loggedInItNumber;

                                        return (
                                          <div key={idx} className={`chat-message ${isOwnMessage ? 'own' : 'other'}`}>
                                            <strong>{isOwnMessage ? 'You' : (msg.senderName && msg.senderName !== 'You' ? msg.senderName : 'Other party')}</strong>
                                            <p>{msg.content}</p>
                                            <small>{new Date(msg.createdAt).toLocaleTimeString()}</small>
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <p className="chat-empty">No messages yet. Start the conversation!</p>
                                    )}
                                  </div>
                                  <div className="chat-input-area">
                                    <input
                                      type="text"
                                      placeholder="Send a message..."
                                      value={requestMessageInputs[messageKey] || ''}
                                      onChange={(event) =>
                                        setRequestMessageInputs((prev) => ({ ...prev, [messageKey]: event.target.value }))
                                      }
                                      onKeyPress={(event) => {
                                        if (event.key === 'Enter') {
                                          sendRequestMessage(group._id, request._id);
                                        }
                                      }}
                                    />
                                    <button
                                      type="button"
                                      className="send-msg-btn"
                                      onClick={() => sendRequestMessage(group._id, request._id)}
                                      disabled={sendingMessageKey === messageKey}
                                    >
                                      {sendingMessageKey === messageKey ? 'Sending...' : 'Send'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <p className="empty">No pending requests for this group.</p>
                    )}
                    <div className="profile-actions">
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => saveProfileGroup(group)}
                        disabled={savingGroupId === group._id}
                      >
                        {savingGroupId === group._id ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        type="button"
                        className="danger-btn"
                        onClick={() => removeProfileGroup(group._id)}
                        disabled={deletingGroupId === group._id}
                      >
                        {deletingGroupId === group._id ? 'Deleting...' : 'Delete Group'}
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="empty">No profile groups loaded yet.</p>
            )}
          </div>
        </section>
      ) : null}

      <footer className="app-footer">
        <p>Copyright © 2026 Developed by Aenuka Buddhakorala.</p>
        <a href="https://github.com/Aenuka/RPFinder" target="_blank" rel="noreferrer">
          Project Repository: https://github.com/Aenuka/RPFinder
        </a>
      </footer>
    </div>
  );
}

export default App;
