import { Item, CreateItemRequest, UpdateItemRequest, ItemSearchQuery, ItemsResponse } from '@/types/item';

export const dataService = {
  getItems: jest.fn<Promise<ItemsResponse>, [ItemSearchQuery]>(),
  getItemById: jest.fn<Promise<Item | null>, [string]>(),
  createItem: jest.fn<Promise<Item>, [CreateItemRequest]>(),
  updateItem: jest.fn<Promise<Item | null>, [string, UpdateItemRequest]>(),
  deleteItem: jest.fn<Promise<boolean>, [string]>(),
  findItemByBarcode: jest.fn<Promise<Item | null>, [string]>(),
  initializeSheet: jest.fn<Promise<void>, []>(),
};