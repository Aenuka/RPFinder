const express = require('express');
const {
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
} = require('../controllers/groupController');
const {
  requireProfileAuth,
  requireMatchingProfileIt,
  requireGroupMemberAccess,
} = require('../middleware/profileAuth');

const router = express.Router();

router.post('/', createGroup);
router.get('/', getAllGroups);
router.get('/size/:size', getGroupsBySize);
router.get('/member/:itNumber', requireProfileAuth, requireMatchingProfileIt, getGroupsByMemberItNumber);
router.get('/requests/requester/:itNumber', requireProfileAuth, requireMatchingProfileIt, getRequestsByRequesterItNumber);
router.post('/:id/requests', requestMemberDetail);
router.post('/:id/requests/:requestId/messages', sendDetailRequestMessage);
router.delete('/:id/requests/:requestId', requireProfileAuth, deleteDetailRequestChat);
router.put('/:id', requireProfileAuth, requireGroupMemberAccess, updateGroup);
router.delete('/:id', requireProfileAuth, requireGroupMemberAccess, deleteGroup);

module.exports = router;
