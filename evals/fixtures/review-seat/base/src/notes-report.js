"use strict";
// The daily notes report: one line per note id; a note deleted since shows as "(gone)".
const { getNote } = require("./notes");

function reportLines(ids) {
  return ids.map((id) => {
    const note = getNote(id);
    if (note === null) return `${id}  (gone)`;
    return `${id}  ${note.orderId}  ${note.text.slice(0, 40)}`;
  });
}

module.exports = { reportLines };
