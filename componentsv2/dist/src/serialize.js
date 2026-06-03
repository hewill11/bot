"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportMessage = exportMessage;
exports.importMessage = importMessage;
exports.serializeMessage = serializeMessage;
exports.deserializeMessage = deserializeMessage;
exports.stringifyMessage = stringifyMessage;
exports.parseMessage = parseMessage;
exports.exportComponent = exportComponent;
exports.importComponent = importComponent;
exports.cloneComponent = cloneComponent;
/**
 * Standalone serialization / import-export helpers.
 *
 * These wrap the methods on the builders so callers who prefer free functions
 * (e.g. a draft store) have a single, explicit surface:
 *
 *   build  →  exportMessage / serializeMessage   →  store / send
 *   stored →  importMessage / deserializeMessage  →  edit again
 */
const builders_1 = require("./builders");
// ---- Message level ----------------------------------------------------------
/** EXPORT to Discord API format `{ flags, components }` (ready for channel.send). */
function exportMessage(builder) {
    return builder.toJSON();
}
/** IMPORT from a raw Discord API message payload into an editable builder. */
function importMessage(payload) {
    return builders_1.MessageV2Builder.fromAPI(payload);
}
/** SERIALIZE to a portable versioned document (plain JSON, safe to persist). */
function serializeMessage(builder) {
    return builder.serialize();
}
/** DESERIALIZE a stored document (object or JSON string) back into a builder. */
function deserializeMessage(doc) {
    return builders_1.MessageV2Builder.deserialize(doc);
}
/** Convenience: builder → JSON string. */
function stringifyMessage(builder) {
    return JSON.stringify(builder.serialize());
}
/** Convenience: JSON string → builder. */
function parseMessage(json) {
    return builders_1.MessageV2Builder.deserialize(json);
}
// ---- Single component level -------------------------------------------------
/** EXPORT a single top-level component builder to API JSON. */
function exportComponent(builder) {
    return builder.toJSON();
}
/** IMPORT a single top-level component from API JSON into a builder. */
function importComponent(api) {
    return (0, builders_1.topLevelBuilderFrom)(api);
}
/** Deep clone any component JSON (handy before mutating an imported tree). */
function cloneComponent(component) {
    return JSON.parse(JSON.stringify(component));
}
//# sourceMappingURL=serialize.js.map