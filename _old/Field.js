const _ = require('lodash');
const Type = require('./Type');
const Field = require('../graphql/ast/Field');
const Rule = require('../core/Rule');
const Transformer = require('../core/Transformer');
const { uvl, isPlainObject, ensureArray, promiseChain } = require('../service/app.service');

module.exports = class extends Field {
  constructor(model, field) {
    super(model, JSON.parse(JSON.stringify((field.getAST()))));
    this.type = new Type(field);
    this.model = model;
    this.allSerializers = [...this.getTransformers(), ...this.getSerializers()];
    this.allDeserializers = [...this.getTransformers(), ...this.getDeserializers()];
  }

  // CRUD
  count(resolver, doc, w = {}) {
    const where = _.cloneDeep(w);
    const fieldRef = this.getModelRef();

    if (this.isVirtual()) {
      where[this.getVirtualRef()] = doc.id;
      return resolver.match(fieldRef).where(where).count();
    }

    if (!Object.keys(where).length) {
      return (doc[this.getName()] || []).length; // Making big assumption that it's an array
    }

    const ids = (doc[this.getName()] || []);
    where[fieldRef.idKey()] = ids;
    return resolver.match(fieldRef).where(where).count();
  }

  cast(value) {
    if (value == null) return value;
    const casted = Transformer.cast(this.getType())(this, value);
    return this.isArray() ? ensureArray(casted) : casted;
  }

  getRules() {
    const rules = [];

    Object.entries(this.getDirectiveArgs('field', {})).forEach(([key, value]) => {
      if (!Array.isArray(value)) value = [value];
      if (key === 'enforce') rules.push(...value.map(r => Rule.getInstances()[r]));
    });

    if (this.isRequired() && this.isPersistable()) rules.push(Rule.required());

    return rules.concat(this.type.getRules());
  }

  getTransformers() {
    const transformers = [];

    Object.entries(this.getDirectiveArgs('field', {})).forEach(([key, value]) => {
      if (!Array.isArray(value)) value = [value];
      if (key === 'transform') transformers.push(...value.map(t => Transformer.getInstances()[t]));
    });

    return transformers.concat(this.type.getTransformers());
  }

  getSerializers() {
    const transformers = [];

    Object.entries(this.getDirectiveArgs('field', {})).forEach(([key, value]) => {
      if (!Array.isArray(value)) value = [value];
      if (key === 'serialize') transformers.push(...value.map(t => Transformer.getInstances()[t]));
    });

    return transformers.concat(this.type.getSerializers());
  }

  getDeserializers() {
    const transformers = [];

    Object.entries(this.getDirectiveArgs('field', {})).forEach(([key, value]) => {
      if (!Array.isArray(value)) value = [value];
      if (key === 'deserialize') transformers.push(...value.map(t => Transformer.getInstances()[t]));
    });

    return transformers.concat(this.type.getDeserializers());
  }

  getResolvers() {
    const resolvers = [];

    Object.entries(this.getDirectiveArgs('field', {})).forEach(([key, value]) => {
      if (!Array.isArray(value)) value = [value];
      if (key === 'resolve') resolvers.push(...value.map(t => Transformer.getInstances()[t]));
    });

    return resolvers.concat(this.type.getResolvers());
  }

  // serialize(value, mapper) {
  //   return this.transform(value, mapper, true);
  // }

  // deserialize(value, mapper) {
  //   return this.transform(value, mapper, false, true);
  // }

  // serialize(value) {
  //   const modelRef = this.getModelRef();
  //   const serializers = [...this.getTransformers(), ...this.getSerializers()];
  //   if (modelRef) {
  //     serializers.push(Transformer.serialize());
  //     if (!this.isEmbedded()) serializers.push(Transformer.toId());
  //   }
  //   return this.applyTransformers(serializers, value);
  // }

  // deserialize(value) {
  //   const modelRef = this.getModelRef();
  //   const transformed = this.applyTransformers(this.allDeserializers, value);
  //   return modelRef ? modelRef.transform(transformed) : transformed;
  //   // if ((modelRef && !modelRef.isEntity()) && isPlainObject(ensureArray(value)[0])) return modelRef.transform(transformed); // delegate
  //   // return transformed;
  // }

  // resolve(value) {
  //   const resolvers = [...this.getResolvers()];

  //   return promiseChain(resolvers.map(resolver => (chain) => {
  //     return Promise.resolve(resolver(this, uvl(chain.pop(), value)));
  //   })).then((results) => {
  //     return uvl(results.pop(), value);
  //   });
  // }

  // normalize(value, mapper) {
  //   mapper = mapper || {};
  //   const modelRef = this.getModelRef();
  //   const transformers = [...this.getTransformers()];

  //   // If we're a modelRef field, need to either id(value) or delegate object to model
  //   if (modelRef) {
  //     if (!modelRef.isEntity() && isPlainObject(ensureArray(value)[0])) return modelRef.normalize(value, mapper); // delegate
  //     if (!this.isEmbedded()) transformers.push(Transformer.toId());
  //   }

  //   // Perform transformation
  //   return this.applyTransformers(transformers, value, mapper, !this.isEmbedded());
  // }

  // transform(value, mapper, serialize, deserialize) {
  //   mapper = mapper || {};
  //   const modelRef = this.getModelRef();
  //   const transformers = [...this.getTransformers()];
  //   if (serialize) transformers.push(...this.getSerializers());
  //   if (deserialize) transformers.push(...this.getDeserializers());

  //   // If we're a modelRef field, need to either id(value) or delegate object to model
  //   if (modelRef) {
  //     if ((!serialize || !modelRef.isEntity()) && isPlainObject(ensureArray(value)[0])) return modelRef.transform(this.applyTransformers(transformers, value, mapper), mapper); // delegate
  //     if (serialize) transformers.push(Transformer.serialize()); // Serializer
  //     if (!this.isEmbedded()) transformers.push(Transformer.toId());
  //   }

  //   // Perform transformation
  //   return this.applyTransformers(transformers, value, mapper);
  // }

  // applyTransformers(transformers, value, mapper = {}, cast = true) {
  //   return transformers.reduce((prev, transformer) => {
  //     const cmp = mapper[transformer.method];
  //     return transformer(this, prev, cmp);
  //   }, cast ? this.cast(value) : value);
  // }

  validate(value, mapper) {
    mapper = mapper || {};
    const modelRef = this.getModelRef();
    const rules = [...this.getRules()];

    if (modelRef) {
      if (isPlainObject(ensureArray(value)[0])) return modelRef.validate(value, mapper); // Model delegation
      if (!this.isEmbedded()) rules.push(Rule.ensureId());
    }

    return Promise.all(rules.map((rule) => {
      const cmp = mapper[rule.method];
      return rule(this, value, cmp);
    }));
  }
};