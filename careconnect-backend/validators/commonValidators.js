const { param } = require('express-validator');

const mongoIdParam = (name = 'id') => [param(name).isMongoId().withMessage(`Invalid ${name}`)];

module.exports = { mongoIdParam };
