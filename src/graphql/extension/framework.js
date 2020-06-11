const Rule = require('../../core/Rule');
const Transformer = require('../../core/Transformer');

module.exports = (schema) => {
  return {
    typeDefs: `
      scalar AutoGraphMixed
      scalar AutoGraphDriver
      scalar AutoGraphDateTime @field(transform: toDate)
      enum AutoGraphEnforceEnum { ${Object.keys(Rule.getInstances()).join(' ')} }
      enum AutoGraphTransformEnum  { ${Object.keys(Transformer.getInstances()).join(' ')} }
      enum AutoGraphAuthzEnum { private protected public }
      enum AutoGraphValueScopeEnum { self context }
      enum AutoGraphOnDeleteEnum { cascade nullify restrict }
      enum AutoGraphIndexEnum { unique }

      directive @model(
        id: String # Override the ID name
        key: String # Specify it's key during transit
        gqlScope: AutoGraphMixed # Dictate how GraphQL API behaves
        dalScope: AutoGraphMixed # Dictate how the DAL behaves
        fieldScope: AutoGraphMixed # Dictate how a FIELD may use me
        meta: String # Custom input 'meta' field for mutations
        embed: Boolean # Mark this an embedded model (default false)
        persist: Boolean # Persist this model (default true)
        driver: AutoGraphDriver # External data driver
        authz: AutoGraphAuthzEnum # Access level used for authorization (default: private)
        namespace: String
        createdAt: String
        updatedAt: String
      ) on OBJECT

      directive @field(
        id: Boolean # Indicate if this field should behave as an ID
        key: String # Specify it's key during transit
        gqlScope: AutoGraphMixed # Dictate how GraphQL API behaves
        dalScope: AutoGraphMixed # Dictate how the DAL behaves
        persist: Boolean # Persist this field (default true)
        default: AutoGraphMixed # Define a default value

        noRepeat: Boolean
        materializeBy: String

        authz: AutoGraphAuthzEnum # Access level used for authorization (default: private)
        enforce: [AutoGraphEnforceEnum!]
        onDelete: AutoGraphOnDeleteEnum
        transform: [AutoGraphTransformEnum!]
      ) on FIELD_DEFINITION | INPUT_FIELD_DEFINITION | SCALAR

      directive @value(
        path: String! # The path to the data
        merge: Boolean # Should it be merged? (overwrite default)
        scope: AutoGraphValueScopeEnum # Where to look for the data (default self)
      ) on OBJECT | FIELD_DEFINITION | INPUT_FIELD_DEFINITION | SCALAR

      directive @index(
        name: String
        on: [AutoGraphMixed!]!
        type: AutoGraphIndexEnum!
      ) repeatable on OBJECT
    `,
  };
};
