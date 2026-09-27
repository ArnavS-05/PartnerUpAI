import { MemoryStore } from './memoryStore';
const store = new MemoryStore();
export function getStore(){return store;}
