const { get } = require('lodash');
const ServerResolver = require('../../core/ServerResolver');
const { ucFirst, fromGUID } = require('../../service/app.service');
const { findGQLModels } = require('../../service/schema.service');
const { makeCreateAPI, makeReadAPI, makeUpdateAPI, makeDeleteAPI, makeInputSplice, makeQueryResolver, makeMutationResolver } = require('../../service/decorator.service');

const getGQLWhereFields = (model) => {
  return model.getFields().filter((field) => {
    if (!field.hasGQLScope('r')) return false;
    const modelRef = field.getModelRef();
    if (modelRef && !modelRef.isEmbedded() && !modelRef.isEntity()) return false;
    return true;
  });
};

module.exports = (schema) => {
  const resolver = new ServerResolver();
  const allModels = schema.getModels();
  const markedModels = schema.getMarkedModels();
  const createModels = findGQLModels('c', markedModels, allModels);
  const readModels = findGQLModels('r', markedModels, allModels);
  const updateModels = findGQLModels('u', markedModels, allModels);
  const deleteModels = findGQLModels('d', markedModels, allModels);
  const spliceModels = [...new Set([...createModels, ...updateModels, ...deleteModels])];

  return ({
    typeDefs: [
      ...createModels.map(model => `
        input ${model.getName()}InputCreate {
          ${model.getFields().filter(field => field.hasGQLScope('c') && !field.isVirtual()).map(field => `${field.getName()}: ${field.getGQLType('InputCreate')}`)}
        }
      `),

      ...updateModels.map(model => `
        input ${model.getName()}InputUpdate {
          ${model.getFields().filter(field => field.hasGQLScope('u') && !field.isVirtual()).map(field => `${field.getName()}: ${field.getGQLType('InputUpdate')}`)}
        }
        # ${makeInputSplice(model)}
      `),

      ...readModels.map(model => `
        input ${model.getName()}InputWhere {
          ${getGQLWhereFields(model).map(field => `${field.getName()}: ${field.getModelRef() ? `${ucFirst(field.getDataRef())}InputWhere` : 'AutoGraphMixed'}`)}
        }
        input ${model.getName()}InputSort {
          ${getGQLWhereFields(model).map(field => `${field.getName()}: ${field.getModelRef() ? `${ucFirst(field.getDataRef())}InputSort` : 'SortOrderEnum'}`)}
        }
      `),

      ...readModels.map(model => `
        extend type ${model.getName()} {
          ${model.getFields().filter(field => field.hasGQLScope('r')).map(field => `${field.getName()}${field.getExtendArgs()}: ${field.getPayloadType()}`)}
        }
        type ${model.getName()}Connection {
          pageInfo: PageInfo!
          edges: [${model.getName()}Edge]
          count: Int!
        }
        type ${model.getName()}Edge {
          node: ${model.getName()}
          cursor: String!
        }
      `),

      ...spliceModels.map(model => `
        #input ${model.getName()}InputSplice {
        #  with: ${model}InputWhere
        #  put: ${model}InputUpdate
        #}
      `),
    ].concat([
      `type PageInfo {
        startCursor: String!
        endCursor: String!
        hasPreviousPage: Boolean!
        hasNextPage: Boolean!
      }`,

      `type Query {
        node(id: ID!): Node
        ${schema.getEntityModels().map(model => makeReadAPI(model.getName(), model))}
      }`,

      `type Mutation {
        _noop: String
        ${schema.getEntityModels().map(model => makeCreateAPI(model.getName(), model))}
        ${schema.getEntityModels().map(model => makeUpdateAPI(model.getName(), model))}
        ${schema.getEntityModels().map(model => makeDeleteAPI(model.getName(), model))}
      }`,
    ]),
    resolvers: readModels.reduce((prev, model) => {
      const modelName = model.getName();

      // Default field resolvers
      const fieldResolvers = model.getFields().filter(field => field.hasGQLScope('r')).reduce((def, field) => {
        const fieldName = field.getName();
        const isConnection = field.isConnection();

        return Object.assign(def, {
          [fieldName]: (root, args, { autograph }) => {
            if (fieldName === 'id') return autograph.legacyMode ? root.id : root.$id;

            const $fieldName = `$${fieldName}`;

            if (isConnection) {
              return {
                args,
                edges: root[$fieldName], // Thunk to the data/edges
                pageInfo: root[$fieldName], // You still need the data/edges to get pageInfo!
                count: root[`${$fieldName}:count`], // Thunk to $$count
              };
            }

            return root[$fieldName](args);
          },
        });
      }, {});

      return Object.assign(prev, {
        [modelName]: fieldResolvers,
        [`${modelName}Connection`]: {
          edges: ({ edges, args }) => edges(args).then(rs => rs.map(node => ({ cursor: get(node, '$$cursor'), node }))),
          pageInfo: ({ pageInfo, args }) => pageInfo(args).then(rs => get(rs, '$$pageInfo')),
          count: ({ count, args }) => count(args),
        },
      });
    }, {
      Node: {
        __resolveType: (root, args, context, info) => root.__typename || fromGUID(root.$id)[0],
      },

      Query: schema.getEntityModels().reduce((prev, model) => {
        return Object.assign(prev, makeQueryResolver(model.getName(), model, resolver));
      }, {
        node: (root, args, context, info) => {
          const { id } = args;
          const [modelName] = fromGUID(id);
          const model = schema.getModel(modelName);
          return resolver.get(context, model, args, false, info);
        },
      }),

      Mutation: schema.getEntityModels().reduce((prev, model) => {
        return Object.assign(prev, makeMutationResolver(model.getName(), model, resolver));
      }, {}),
    }),
  });
};
