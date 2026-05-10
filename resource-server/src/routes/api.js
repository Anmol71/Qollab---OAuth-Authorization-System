'use strict';
const express = require('express');
const tokenValidator = require('../middleware/tokenValidator');
const requireScope = require('../middleware/scopeCheck');

const router = express.Router();

router.use(tokenValidator);

router.get('/profile', requireScope('profile'), function (req, res) {
  const displayName = req.tokenPayload.name || 'User';
  const displayEmail = req.tokenPayload.email || 'user@example.com';
  res.json({
    id: req.tokenPayload.sub,
    name: displayName,
    email: displayEmail,
    avatar:
      'https://ui-avatars.com/api/?name=' +
      encodeURIComponent(displayName) +
      '&background=4F46E5&color=fff&size=128',
    bio: 'OAuth 2.0 connected account',
    location: 'San Francisco, CA',
    created_at: '2023-01-15T10:00:00Z',
    granted_scope: req.tokenPayload.scope
  });
});

router.get('/wishlist', requireScope('wishlist'), function (req, res) {
  res.json({
    wishlist: [
      {
        id: 'w1',
        product_name: 'Wireless Headphones',
        product_id: 'prod-001',
        price: 4999,
        image_url: 'https://via.placeholder.com/80?text=Headphones',
        added_at: '2024-01-10',
        availability: 'In Stock'
      },
      {
        id: 'w2',
        product_name: 'USB-C Hub',
        product_id: 'prod-002',
        price: 1999,
        image_url: 'https://via.placeholder.com/80?text=Hub',
        added_at: '2024-01-15',
        availability: 'In Stock'
      },
      {
        id: 'w3',
        product_name: 'Smart Watch',
        product_id: 'prod-003',
        price: 12999,
        image_url: 'https://via.placeholder.com/80?text=Watch',
        added_at: '2024-01-18',
        availability: 'Out of Stock'
      }
    ],
    total: 3,
    granted_scope: req.tokenPayload.scope
  });
});

router.get('/orders', requireScope('orders'), function (req, res) {
  res.json({
    orders: [
      {
        id: 'ord-001',
        order_number: 'ORD-2024-001',
        date: '2024-01-05',
        total: 15999,
        status: 'Delivered',
        items_count: 2,
        tracking_id: 'TRK-123456'
      },
      {
        id: 'ord-002',
        order_number: 'ORD-2024-002',
        date: '2024-01-10',
        total: 8499,
        status: 'In Transit',
        items_count: 1,
        tracking_id: 'TRK-789012'
      },
      {
        id: 'ord-003',
        order_number: 'ORD-2024-003',
        date: '2024-01-15',
        total: 4999,
        status: 'Processing',
        items_count: 1,
        tracking_id: 'TRK-345678'
      }
    ],
    total: 3,
    granted_scope: req.tokenPayload.scope
  });
});

router.get('/account', requireScope('account'), function (req, res) {
  res.json({
    account: {
      primary_email: req.tokenPayload.email,
      phone: '+91-98765-43210',
      default_address: {
        address_line_1: '123 Tech Street',
        city: 'San Francisco',
        state: 'CA',
        zipcode: '94105',
        country: 'USA'
      },
      notification_preferences: {
        order_updates: true,
        promotional_emails: false,
        wishlist_alerts: true
      },
      account_tier: 'Premium',
      member_since: '2023-01-15',
      saved_payment_methods: 2
    },
    granted_scope: req.tokenPayload.scope
  });
});

router.get('/contacts', requireScope('contacts'), function (req, res) {
  res.json({
    contacts: [
      {
        id: 'c1',
        name: 'Charlie Brown',
        email: 'charlie@example.com',
        phone: '+1-555-0101',
        company: 'Acme Corp'
      },
      {
        id: 'c2',
        name: 'Diana Prince',
        email: 'diana@example.com',
        phone: '+1-555-0102',
        company: 'Wayne Enterprises'
      },
      {
        id: 'c3',
        name: 'Edward Norton',
        email: 'edward@example.com',
        phone: '+1-555-0103',
        company: 'Stark Industries'
      }
    ],
    total: 3,
    granted_scope: req.tokenPayload.scope
  });
});

module.exports = router;
