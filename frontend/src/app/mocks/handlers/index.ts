import { authHandlers } from './authHandlers';
import { checklistHandlers } from './checklistHandlers';
import { commuteAreaHandlers } from './commuteAreaHandlers';
import { mapHandlers } from './mapHandlers';
import { propertyChecklistHandlers } from './propertyChecklistHandlers';
import { propertyHandlers } from './propertyHandlers';

export const handlers = [
  ...authHandlers,
  ...propertyHandlers,
  ...checklistHandlers,
  ...propertyChecklistHandlers,
  ...mapHandlers,
  ...commuteAreaHandlers,
];
