const assert = require('assert');

function simulateRender(changesJson) {
  const changes = JSON.parse(changesJson);
  const allKeys = Object.keys(changes);
  
  const filteredKeys = allKeys.filter(key => {
     const change = changes[key];
     if (change && typeof change === 'object' && ('from' in change || 'to' in change)) {
        const isEmptyFrom = change.from === null || change.from === undefined || change.from === '';
        const isEmptyTo = change.to === null || change.to === undefined || change.to === '';
        if (isEmptyFrom && isEmptyTo) return false;
        if (String(change.from) === String(change.to)) return false;
        return true;
     } else {
        const isEmpty = change === null || change === undefined || change === '';
        if (isEmpty) return false;
        return true;
     }
  });

  return filteredKeys;
}

const log7 = "{\"firstName\":\"יוספ\",\"lastName\":\" ברדא רחל\",\"phone1\":\"4531232454\",\"phone2\":null,\"email\":null,\"city\":null,\"street\":null,\"houseNum\":null,\"notes\":null}";
console.log("log7 filtered keys:", simulateRender(log7));

const log6 = "{\"firstName\":{\"from\":null,\"to\":\"יוספ\"}}";
console.log("log6 filtered keys:", simulateRender(log6));
