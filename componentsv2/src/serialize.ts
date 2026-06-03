/**
 * Standalone serialization / import-export helpers.
 *
 * These wrap the methods on the builders so callers who prefer free functions
 * (e.g. a draft store) have a single, explicit surface:
 *
 *   build  →  exportMessage / serializeMessage   →  store / send
 *   stored →  importMessage / deserializeMessage  →  edit again
 */
import {
  MessageV2Builder,
  topLevelBuilderFrom,
  type TopLevelBuilder,
} from './builders';
import type {
  APIComponentV2,
  APIMessageComponentsV2Payload,
  APITopLevelComponent,
  SerializedDocumentV2,
} from './types';

// ---- Message level ----------------------------------------------------------

/** EXPORT to Discord API format `{ flags, components }` (ready for channel.send). */
export function exportMessage(builder: MessageV2Builder): APIMessageComponentsV2Payload {
  return builder.toJSON();
}

/** IMPORT from a raw Discord API message payload into an editable builder. */
export function importMessage(payload: Partial<APIMessageComponentsV2Payload>): MessageV2Builder {
  return MessageV2Builder.fromAPI(payload);
}

/** SERIALIZE to a portable versioned document (plain JSON, safe to persist). */
export function serializeMessage(builder: MessageV2Builder): SerializedDocumentV2 {
  return builder.serialize();
}

/** DESERIALIZE a stored document (object or JSON string) back into a builder. */
export function deserializeMessage(doc: SerializedDocumentV2 | string): MessageV2Builder {
  return MessageV2Builder.deserialize(doc);
}

/** Convenience: builder → JSON string. */
export function stringifyMessage(builder: MessageV2Builder): string {
  return JSON.stringify(builder.serialize());
}

/** Convenience: JSON string → builder. */
export function parseMessage(json: string): MessageV2Builder {
  return MessageV2Builder.deserialize(json);
}

// ---- Single component level -------------------------------------------------

/** EXPORT a single top-level component builder to API JSON. */
export function exportComponent(builder: TopLevelBuilder): APITopLevelComponent {
  return builder.toJSON() as APITopLevelComponent;
}

/** IMPORT a single top-level component from API JSON into a builder. */
export function importComponent(api: APITopLevelComponent): TopLevelBuilder {
  return topLevelBuilderFrom(api);
}

/** Deep clone any component JSON (handy before mutating an imported tree). */
export function cloneComponent<T extends APIComponentV2>(component: T): T {
  return JSON.parse(JSON.stringify(component)) as T;
}
