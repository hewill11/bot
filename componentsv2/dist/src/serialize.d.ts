/**
 * Standalone serialization / import-export helpers.
 *
 * These wrap the methods on the builders so callers who prefer free functions
 * (e.g. a draft store) have a single, explicit surface:
 *
 *   build  →  exportMessage / serializeMessage   →  store / send
 *   stored →  importMessage / deserializeMessage  →  edit again
 */
import { MessageV2Builder, type TopLevelBuilder } from './builders';
import type { APIComponentV2, APIMessageComponentsV2Payload, APITopLevelComponent, SerializedDocumentV2 } from './types';
/** EXPORT to Discord API format `{ flags, components }` (ready for channel.send). */
export declare function exportMessage(builder: MessageV2Builder): APIMessageComponentsV2Payload;
/** IMPORT from a raw Discord API message payload into an editable builder. */
export declare function importMessage(payload: Partial<APIMessageComponentsV2Payload>): MessageV2Builder;
/** SERIALIZE to a portable versioned document (plain JSON, safe to persist). */
export declare function serializeMessage(builder: MessageV2Builder): SerializedDocumentV2;
/** DESERIALIZE a stored document (object or JSON string) back into a builder. */
export declare function deserializeMessage(doc: SerializedDocumentV2 | string): MessageV2Builder;
/** Convenience: builder → JSON string. */
export declare function stringifyMessage(builder: MessageV2Builder): string;
/** Convenience: JSON string → builder. */
export declare function parseMessage(json: string): MessageV2Builder;
/** EXPORT a single top-level component builder to API JSON. */
export declare function exportComponent(builder: TopLevelBuilder): APITopLevelComponent;
/** IMPORT a single top-level component from API JSON into a builder. */
export declare function importComponent(api: APITopLevelComponent): TopLevelBuilder;
/** Deep clone any component JSON (handy before mutating an imported tree). */
export declare function cloneComponent<T extends APIComponentV2>(component: T): T;
//# sourceMappingURL=serialize.d.ts.map