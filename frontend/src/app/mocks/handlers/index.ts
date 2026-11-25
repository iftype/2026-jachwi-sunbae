import { adminDongBookmarkHandlers } from './adminDongBookmarkHandlers';
import { authHandlers } from './authHandlers';
import { checklistHandlers } from './checklistHandlers';
import { commuteAreaHandlers } from './commuteAreaHandlers';
import { mapHandlers } from './mapHandlers';
import { mealHandlers } from './mealHandlers';
import { propertyChecklistHandlers } from './propertyChecklistHandlers';
import { propertyHandlers } from './propertyHandlers';
import { streetMemoHandlers } from './streetMemoHandlers';
import { weatherHandlers } from './weatherHandlers';

export const handlers = [
  ...authHandlers,
  ...adminDongBookmarkHandlers,
  ...propertyHandlers,
  ...checklistHandlers,
  ...propertyChecklistHandlers,
  ...mapHandlers,
  ...mealHandlers,
  ...commuteAreaHandlers,
  ...streetMemoHandlers,
  ...weatherHandlers,
];
