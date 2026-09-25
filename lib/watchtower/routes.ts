// Registers every route module, then re-exports the router's handle().
import './static-register';
import './api/core';
import './api/ai';

export { handle } from './http/router';
