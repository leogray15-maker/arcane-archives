// Registers every route module, then re-exports the router's handle().
import './api/core';

export { handle } from './http/router';
