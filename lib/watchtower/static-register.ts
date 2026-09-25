// Bundles the versioned reference datasets (data/watchtower/*.v1.json) into the
// function. They are served only through the gated bootstrap endpoint.
import { registerStatic } from './static-data';
/* eslint-disable @typescript-eslint/no-var-requires */
registerStatic('bases', require('../../data/watchtower/bases.v1.json'));
registerStatic('nuclear', require('../../data/watchtower/nuclear.v1.json'));
registerStatic('spaceports', require('../../data/watchtower/spaceports.v1.json'));
registerStatic('datacenters', require('../../data/watchtower/datacenters.v1.json'));
registerStatic('cables', require('../../data/watchtower/cables.v1.json'));
registerStatic('pipelines', require('../../data/watchtower/pipelines.v1.json'));
registerStatic('chokepoints', require('../../data/watchtower/chokepoints.v1.json'));
registerStatic('hotspots', require('../../data/watchtower/hotspots.v1.json'));
