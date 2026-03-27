const Group = require('../models/groupModel');

const createGroup = async (req, res, next) => {
  try {
    const group = await Group.create(req.body);
    return res.status(201).json(group);
  } catch (error) {
    return next(error);
  }
};

const getAllGroups = async (req, res, next) => {
  try {
    const groups = await Group.find().sort({ createdAt: -1 });
    return res.status(200).json(groups);
  } catch (error) {
    return next(error);
  }
};

const getGroupsBySize = async (req, res, next) => {
  try {
    const size = Number(req.params.size);

    if (!Number.isInteger(size) || size < 1 || size > 4) {
      return res.status(400).json({ message: 'Size must be an integer from 1 to 4.' });
    }

    const groups = await Group.find({
      $expr: {
        $eq: [{ $size: '$members' }, size],
      },
    }).sort({ createdAt: -1 });

    return res.status(200).json(groups);
  } catch (error) {
    return next(error);
  }
};

const getGroupsByMemberItNumber = async (req, res, next) => {
  try {
    const itNumber = String(req.params.itNumber || '').trim().toUpperCase();

    if (!/^IT\d{8}$/.test(itNumber)) {
      return res.status(400).json({ message: 'IT number must be in ITXXXXXXXX format.' });
    }

    const groups = await Group.find({
      members: {
        $elemMatch: { itNumber },
      },
    }).sort({ createdAt: -1 });

    return res.status(200).json(groups);
  } catch (error) {
    return next(error);
  }
};

const getRequestsByRequesterItNumber = async (req, res, next) => {
  try {
    const itNumber = String(req.params.itNumber || '').trim().toUpperCase();

    if (!/^IT\d{8}$/.test(itNumber)) {
      return res.status(400).json({ message: 'IT number must be in ITXXXXXXXX format.' });
    }

    const groups = await Group.find({
      detailRequests: {
        $elemMatch: {
          requesterItNumber: itNumber,
          resolved: false,
        },
      },
    }).sort({ createdAt: -1 });

    const mergedByMember = new Map();

    groups.forEach((group) => {
      (group.detailRequests || [])
        .filter((request) => request.requesterItNumber === itNumber && request.resolved === false)
        .forEach((request) => {
          const mergeKey = `${group._id}-${request.memberItNumber}-${request.requesterItNumber || ''}`;
          const requestFields = [
            ...(Array.isArray(request.requestedFields) ? request.requestedFields : []),
            ...(request.fieldName ? [request.fieldName] : []),
          ].filter(Boolean);

          if (!mergedByMember.has(mergeKey)) {
            mergedByMember.set(mergeKey, {
              groupId: group._id,
              groupStatus: group.groupStatus,
              memberItNumber: request.memberItNumber,
              fieldName: request.fieldName,
              requestedFields: Array.from(new Set(requestFields)),
              requesterName: request.requesterName,
              requesterItNumber: request.requesterItNumber,
              note: request.note,
              resolved: false,
              messages: [...(request.messages || [])],
              createdAt: request.createdAt,
              updatedAt: request.updatedAt,
              requestId: request._id,
              members: group.members,
            });
            return;
          }

          const existing = mergedByMember.get(mergeKey);
          existing.requestedFields = Array.from(new Set([...(existing.requestedFields || []), ...requestFields]));
          if (!existing.note && request.note) {
            existing.note = request.note;
          }
          if (new Date(request.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
            existing.updatedAt = request.updatedAt;
            existing.requestId = request._id;
          }
          if (new Date(request.createdAt).getTime() < new Date(existing.createdAt).getTime()) {
            existing.createdAt = request.createdAt;
          }
          existing.messages = [...existing.messages, ...(request.messages || [])]
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        });
    });

    const requesterRequests = Array.from(mergedByMember.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return res.status(200).json(requesterRequests);
  } catch (error) {
    return next(error);
  }
};

const requestMemberDetail = async (req, res, next) => {
  try {
    const { memberItNumber, fieldName, requesterName, requesterItNumber, note } = req.body;

    const normalizedIt = String(memberItNumber || '').trim().toUpperCase();
    const normalizedField = String(fieldName || '').trim();
    const normalizedRequesterName = String(requesterName || '').trim();
    const normalizedRequesterIt = String(requesterItNumber || '').trim().toUpperCase();
    const allowedFields = ['itNumberShared', 'gpa', 'githubUsername', 'linkedin', 'internshipStatus'];

    if (!/^IT\d{8}$/.test(normalizedIt)) {
      return res.status(400).json({ message: 'memberItNumber must be in ITXXXXXXXX format.' });
    }

    if (!allowedFields.includes(normalizedField)) {
      return res.status(400).json({ message: 'Invalid fieldName for detail request.' });
    }

    if (!normalizedRequesterName) {
      return res.status(400).json({ message: 'Requester name is required.' });
    }

    if (normalizedRequesterIt && !/^IT\d{8}$/.test(normalizedRequesterIt)) {
      return res.status(400).json({ message: 'requesterItNumber must be in ITXXXXXXXX format.' });
    }

    // Check if requester is registered (has at least one group)
    if (normalizedRequesterIt) {
      const requesterIsRegistered = await Group.exists({
        members: {
          $elemMatch: { itNumber: normalizedRequesterIt },
        },
      });

      if (!requesterIsRegistered) {
        return res.status(403).json({ 
          message: 'You must register at least one group before requesting details.',
          code: 'NOT_REGISTERED',
        });
      }
    }

    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    const memberExists = group.members.some((member) => member.itNumber === normalizedIt);
    if (!memberExists) {
      return res.status(400).json({ message: 'Requested member is not part of this group.' });
    }

    const matchingPendingRequests = group.detailRequests.filter((request) => {
      const sameTarget = request.memberItNumber === normalizedIt && request.resolved === false;

      if (!sameTarget) {
        return false;
      }

      if (normalizedRequesterIt) {
        return request.requesterItNumber === normalizedRequesterIt;
      }

      return request.requesterName === normalizedRequesterName;
    });

    if (matchingPendingRequests.length > 0) {
      const primaryRequest = matchingPendingRequests[0];
      const combinedFields = new Set(
        [
          ...(primaryRequest.requestedFields || []),
          ...(primaryRequest.fieldName ? [primaryRequest.fieldName] : []),
          normalizedField,
        ].filter(Boolean)
      );

      // Consolidate any old duplicate pending threads into this single active chat.
      matchingPendingRequests.slice(1).forEach((request) => {
        (request.requestedFields || []).forEach((field) => combinedFields.add(field));
        if (request.fieldName) {
          combinedFields.add(request.fieldName);
        }
        request.resolved = true;
      });

      primaryRequest.requestedFields = Array.from(combinedFields);
      if (!primaryRequest.fieldName && primaryRequest.requestedFields.length > 0) {
        primaryRequest.fieldName = primaryRequest.requestedFields[0];
      }

      await group.save();
      return res.status(200).json({
        message: 'You already have an active chat for this member. Opening the same chat.',
        request: primaryRequest,
      });
    }

    group.detailRequests.push({
      memberItNumber: normalizedIt,
      fieldName: normalizedField,
      requestedFields: [normalizedField],
      requesterName: normalizedRequesterName,
      ...(normalizedRequesterIt ? { requesterItNumber: normalizedRequesterIt } : {}),
      note: note || '',
      resolved: false,
    });

    await group.save();
    const createdRequest = group.detailRequests[group.detailRequests.length - 1];
    return res.status(201).json({
      message: 'Detail request submitted successfully.',
      request: createdRequest,
    });
  } catch (error) {
    return next(error);
  }
};

const updateGroup = async (req, res, next) => {
  try {
    const group = req.targetGroup || (await Group.findById(req.params.id));

    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    const updatableFields = [
      'members',
      'expectedFromNewcomer',
      'aboutCurrentMembers',
      'reasonLeftPreviousGroup',
    ];

    updatableFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        group[field] = req.body[field];
      }
    });

    if (Object.prototype.hasOwnProperty.call(req.body, 'members')) {
      group.detailRequests = group.detailRequests.map((request) => {
        const member = group.members.find((item) => item.itNumber === request.memberItNumber);
        if (!member) {
          return request;
        }

        const requestedFields = Array.isArray(request.requestedFields) && request.requestedFields.length > 0
          ? request.requestedFields
          : request.fieldName
            ? [request.fieldName]
            : [];

        const allRequestedFieldsShared = requestedFields.every((field) => {
          const value = member[field];
          return value !== undefined && value !== null && value !== '';
        });

        if (allRequestedFieldsShared && requestedFields.length > 0) {
          request.resolved = true;
        }

        return request;
      });
    }

    const updated = await group.save();
    return res.status(200).json(updated);
  } catch (error) {
    return next(error);
  }
};

const deleteGroup = async (req, res, next) => {
  try {
    const deleted = req.targetGroup || (await Group.findById(req.params.id));

    if (!deleted) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    await deleted.deleteOne();

    return res.status(200).json({ message: 'Group deleted successfully.' });
  } catch (error) {
    return next(error);
  }
};

const sendDetailRequestMessage = async (req, res, next) => {
  try {
    const { id: groupId, requestId } = req.params;
    const { senderItNumber, senderName, content } = req.body;

    if (!groupId || !requestId || !content) {
      return res.status(400).json({ message: 'groupId, requestId, and content are required.' });
    }

    const normalizedContent = String(content || '').trim();
    const normalizedSenderIt = String(senderItNumber || '').trim().toUpperCase();
    const normalizedSenderName = String(senderName || '').trim();

    if (!normalizedContent) {
      return res.status(400).json({ message: 'Message content cannot be empty.' });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    const request = group.detailRequests.find((r) => r._id.toString() === requestId);
    if (!request) {
      return res.status(404).json({ message: 'Detail request not found.' });
    }

    // Add message to request
    request.messages.push({
      senderItNumber: normalizedSenderIt,
      senderName: normalizedSenderName || 'Anonymous',
      content: normalizedContent,
    });

    await group.save();
    return res.status(200).json({ message: 'Message sent successfully.', request });
  } catch (error) {
    return next(error);
  }
};

const deleteDetailRequestChat = async (req, res, next) => {
  try {
    const { id: groupId, requestId } = req.params;
    const currentIt = req.profileAuth?.itNumber;

    if (!groupId || !requestId) {
      return res.status(400).json({ message: 'groupId and requestId are required.' });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    const targetRequest = group.detailRequests.find((request) => request._id.toString() === requestId);
    if (!targetRequest) {
      return res.status(404).json({ message: 'Chat request not found.' });
    }

    const isGroupMember = group.members.some((member) => member.itNumber === currentIt);
    const isRequester = Boolean(targetRequest.requesterItNumber) && targetRequest.requesterItNumber === currentIt;

    if (!isGroupMember && !isRequester) {
      return res.status(403).json({ message: 'You are not allowed to delete this chat.' });
    }

    const targetMemberIt = targetRequest.memberItNumber;
    const targetRequesterIt = targetRequest.requesterItNumber || '';
    const targetRequesterName = targetRequest.requesterName || '';

    // Remove all pending duplicate records belonging to the same logical thread.
    group.detailRequests = group.detailRequests.filter((request) => {
      const sameMember = request.memberItNumber === targetMemberIt;
      const sameRequester = targetRequesterIt
        ? request.requesterItNumber === targetRequesterIt
        : request.requesterName === targetRequesterName;
      const sameThread = sameMember && sameRequester && request.resolved === false;

      if (!sameThread) {
        return true;
      }

      return false;
    });

    await group.save();
    return res.status(200).json({ message: 'Chat deleted successfully.' });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createGroup,
  getAllGroups,
  getGroupsBySize,
  getGroupsByMemberItNumber,
  getRequestsByRequesterItNumber,
  requestMemberDetail,
  updateGroup,
  deleteGroup,
  sendDetailRequestMessage,
  deleteDetailRequestChat,
};
