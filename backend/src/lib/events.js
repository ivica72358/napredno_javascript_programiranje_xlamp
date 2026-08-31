// interna sabirnica dogadaja

import { EventEmitter } from 'node:events';

export const EVENTS = {
  UPLINK: 'uplink',
  LAMP_UPDATED: 'lamp:updated',
  DOWNLINK_SENT: 'downlink:sent',
};

const bus = new EventEmitter();
// jedan listener po dogadaju je uobicajeno, ali granicu dizemo da razvojni
// reload ne bi ispisivao upozorenja o curenju
bus.setMaxListeners(20);

export default bus;
