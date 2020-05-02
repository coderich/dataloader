const Model = require('./Model');
const { makeExecutableSchema, getSchemaDataTypes } = require('../service/schema.service');

const customDirectives = [];

module.exports = class Schema {
  constructor(gqlSchema) {
    this.schema = makeExecutableSchema(gqlSchema, customDirectives);
    this.models = Object.values(getSchemaDataTypes(this.schema)).map(value => new Model(this, value));
  }

  getModels() {
    return this.models;
  }

  getModel(name) {
    return this.models.find(model => model.getName() === name || model.getAlias() === name);
  }

  getExecutableSchema() {
    return this.schema;
  }

  /**
   * Extend the schema with a custom directive
   */
  static custom(def) {
    customDirectives.push(def);
  }
};
