import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

export const createGroup = async (payload) => {
  const response = await api.post('/groups', payload);
  return response.data;
};

export const getGroupsBySize = async (size) => {
  const response = await api.get(`/groups/size/${size}`);
  return response.data;
};

export const getGroupsByMemberItNumber = async (itNumber) => {
  const response = await api.get(`/groups/member/${itNumber}`);
  return response.data;
};

export const getGroupsByMemberItNumberWithAuth = async (itNumber, token) => {
  const response = await api.get(`/groups/member/${itNumber}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const getRequestsByRequesterItNumberWithAuth = async (itNumber, token) => {
  const response = await api.get(`/groups/requests/requester/${itNumber}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const updateGroup = async (groupId, payload, token) => {
  const response = await api.put(`/groups/${groupId}`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const deleteGroup = async (groupId, token) => {
  const response = await api.delete(`/groups/${groupId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const requestMemberDetail = async (groupId, payload) => {
  const response = await api.post(`/groups/${groupId}/requests`, payload);
  return response.data;
};

export const requestEmailOtp = async (payload) => {
  const response = await api.post('/auth/email/request-otp', payload);
  return response.data;
};

export const verifyEmailOtp = async (payload) => {
  const response = await api.post('/auth/email/verify-otp', payload);
  return response.data;
};

export const sendDetailRequestMessage = async (groupId, requestId, payload) => {
  const response = await api.post(`/groups/${groupId}/requests/${requestId}/messages`, payload);
  return response.data;
};

export const deleteDetailRequestChat = async (groupId, requestId, token) => {
  const response = await api.delete(`/groups/${groupId}/requests/${requestId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};
