const axios = require('axios');

const API_BASE = 'https://api.example.com/v1';

async function getUsers(page = 1, pageSize = 20) {
  const response = await axios.get(`${API_BASE}/users`, {
    params: { page, pageSize }
  });
  return response.data;
}

async function getUserById(id) {
  const response = await fetch(`${API_BASE}/users/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch user');
  }
  return response.json();
}

async function createUser(userData) {
  const response = await axios.post(`${API_BASE}/users`, userData);
  return response.data;
}

async function updateUser(id, userData) {
  const response = await axios.put(`/users/${id}`, userData);
  return response.data;
}

async function deleteUser(id) {
  const response = await axios.delete(`/users/${id}`);
  return response.status === 204;
}

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
};
