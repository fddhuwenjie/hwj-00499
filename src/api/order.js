const axios = require('axios');

const ORDER_API = 'https://api.example.com/orders/v1';

async function getOrders(status) {
  const response = await axios.get(`${ORDER_API}/orders`, {
    params: { status, page: 1 }
  });
  return response.data;
}

async function getOrderById(orderId) {
  const response = await fetch(`${ORDER_API}/orders/${orderId}`);
  return response.json();
}

async function createOrder(items) {
  const response = await axios.post('/orders', { items }, {
    baseURL: ORDER_API
  });
  return response.data;
}

async function cancelOrder(orderId) {
  const response = await axios.delete(`/orders/${orderId}`, {
    baseURL: ORDER_API
  });
  return response.status === 204;
}

module.exports = {
  getOrders,
  getOrderById,
  createOrder,
  cancelOrder
};
