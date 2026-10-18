import {refreshWind,pauseWind} from './wind.js';
import {attachWindExperiment} from './passage.js';

// The page composes drawing and numeric passage ownership. The clock consumer stays independent.
attachWindExperiment({refreshWind,pauseWind});
