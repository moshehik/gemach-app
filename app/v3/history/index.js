// נקודת כניסה יחידה לפיד ההיסטוריה v3.
export { default as HistoryFeed } from './HistoryFeed';
export {
  buildFeed, parseChanges, replay, fmtValue, searchHay, dayKey, tsIso, redoState,
  loadOrderHistoryRows, loadDressHistoryRows, mergeRows, itemsIndexFromOrder, missingLabels,
  CATEGORIES, ENTITIES, ACTIONS, FIELDS, ENUMS,
} from './adapter';
