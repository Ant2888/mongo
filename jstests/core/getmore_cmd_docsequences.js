// @tags: [requires_getmore]

// Tests that the getMore command can return more than 16 MB with DocumentSequences.
(function() {
    'use strict';

    var cmdRes;
    var collName = 'getmore_cmd_docsequences';
    var coll = db[collName];
    coll.drop();

    var oneKB = 1024;
    var oneMB = 1024 * oneKB;

    // Build a 15 MB string.
    var dataStr = 'a'.repeat(oneMB*15);
    assert.eq(dataStr.length, 15*oneMB);

    // Put two documents of size 15 MB.
    assert.writeOK(coll.insert({_id: 0, padding: dataStr}));
    assert.writeOK(coll.insert({_id: 1, padding: dataStr}));

    // Get a cursor from find without any results.
    cmdRes = db.runCommand({find: collName, batchSize: 0});
    assert.commandWorked(cmdRes);
    assert.gt(cmdRes.cursor.id, NumberLong(0));
    assert.eq(cmdRes.cursor.ns, coll.getFullName());
    assert.eq(cmdRes.cursor.firstBatch.length, 0);

    // The getMore should return TWO docs since it is using docSequences.
    cmdRes = db.runCommand({getMore: cmdRes.cursor.id, collection: collName,
                                tempOptInToDocumentSequences: true});
    assert.gt(cmdRes.cursor.id, NumberLong(0));
    assert.eq(cmdRes.cursor.ns, coll.getFullName());
    assert.eq(cmdRes.cursor.nextBatch.length, 2);
})();
