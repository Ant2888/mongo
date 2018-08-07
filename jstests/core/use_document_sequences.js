/**
 * Tests that calls that include flags to use documentSequences over the wire protocoll actually
 * return document sequences
 * @tags: [requires_find_command, requires_document_sequences, requires_getmore]
 */
(function() {
    "use strict";

    const coll = db[jsTestName()];
    coll.drop();

    let findRes = assert.commandWorked(db.runCommand({find: jsTestName()}));
    assert.eq(usedDocumentSequences(findRes),
              false,
              "find on empty collection utilized documentSequences when flag was not provided");

    let findResWithDocSeq = assert.commandWorked(
        db.runCommand({find: jsTestName(), tempOptInToDocumentSequences: true}));
    assert.eq(usedDocumentSequences(findResWithDocSeq),
              true,
              "find on empty collection did not utilize documentSequences when flag was provided");

    let aggRes = assert.commandWorked(
        db.runCommand({aggregate: jsTestName(), pipeline: [], cursor: {batchSize: 0}}));
    assert.eq(
        usedDocumentSequences(aggRes),
        false,
        "aggregate on empty collection utilized documentSequences when flag was not provided");

    let aggResWithDocSeq = assert.commandWorked(db.runCommand({
        aggregate: jsTestName(),
        pipeline: [],
        cursor: {batchSize: 0},
        tempOptInToDocumentSequences: true
    }));
    assert.eq(
        usedDocumentSequences(aggResWithDocSeq),
        true,
        "aggregate on empty collection did not utilize documentSequences when flag was provided");

    // Test that an aggregation can return *all* matching data via getMores if the initial aggregate
    // used a batchSize of 0.
    const nDocs = 1000;
    const bulk = coll.initializeUnorderedBulkOp();
    for (let i = 0; i < nDocs; i++) {
        bulk.insert({_id: i, stringField: "string"});
    }
    assert.writeOK(bulk.execute());

    findRes = assert.commandWorked(db.runCommand({find: coll.getName()}));
    assert.eq(usedDocumentSequences(findRes),
              false,
              "find utilized documentSequences when flag was not provided");

    let cursorId = findRes.cursor.id;
    let getMoreRes =
        assert.commandWorked(db.runCommand({getMore: cursorId, collection: coll.getName()}));
    assert.eq(usedDocumentSequences(getMoreRes),
              false,
              "getMore used document sequences when flag passed to neither find nor getMore");

    findRes = assert.commandWorked(db.runCommand({find: coll.getName()}));
    assert.eq(usedDocumentSequences(findRes),
              false,
              "find utilized documentSequences when flag was not provided");

    cursorId = findRes.cursor.id;
    let getMoreResWithDocSeq = assert.commandWorked(db.runCommand(
        {getMore: cursorId, collection: coll.getName(), tempOptInToDocumentSequences: true}));
    assert.eq(usedDocumentSequences(getMoreResWithDocSeq),
              true,
              "getMore didn't use document sequences when flag passed to getMore but not find");

    findResWithDocSeq = assert.commandWorked(
        db.runCommand({find: coll.getName(), tempOptInToDocumentSequences: true}));
    assert.eq(usedDocumentSequences(findResWithDocSeq),
              true,
              "find did not utilize documentSequences when flag was provided");

    cursorId = findResWithDocSeq.cursor.id;
    getMoreRes =
        assert.commandWorked(db.runCommand({getMore: cursorId, collection: coll.getName()}));
    assert.eq(usedDocumentSequences(getMoreRes),
              false,
              "getMore used document sequences when flag passed to find but not getMore");

    findResWithDocSeq = assert.commandWorked(
        db.runCommand({find: coll.getName(), tempOptInToDocumentSequences: true}));
    assert.eq(usedDocumentSequences(findResWithDocSeq),
              true,
              "find did not utilize documentSequences when flag was provided");

    cursorId = findResWithDocSeq.cursor.id;
    getMoreResWithDocSeq = assert.commandWorked(db.runCommand(
        {getMore: cursorId, collection: coll.getName(), tempOptInToDocumentSequences: true}));
    assert.eq(usedDocumentSequences(getMoreResWithDocSeq),
              true,
              "getMore didn't use document sequences when flag passed to getMore and find");

    aggRes = assert.commandWorked(db.runCommand({
        aggregate: coll.getName(),
        pipeline: [{"$match": {stringField: "string"}}],
        cursor: {batchSize: 0}
    }));
    assert.eq(usedDocumentSequences(aggRes),
              false,
              "aggregate utilized documentSequences when flag was not provided");

    cursorId = aggRes.cursor.id;
    getMoreRes =
        assert.commandWorked(db.runCommand({getMore: cursorId, collection: coll.getName()}));
    assert.eq(usedDocumentSequences(getMoreRes),
              false,
              "getMore used document sequences when flag passed to neither aggregate nor getMore");

    aggRes = assert.commandWorked(db.runCommand({
        aggregate: coll.getName(),
        pipeline: [{"$match": {stringField: "string"}}],
        cursor: {batchSize: 0}
    }));
    assert.eq(usedDocumentSequences(aggRes),
              false,
              "aggregate utilized documentSequences when flag was not provided");

    cursorId = aggRes.cursor.id;
    getMoreResWithDocSeq = assert.commandWorked(db.runCommand(
        {getMore: cursorId, collection: coll.getName(), tempOptInToDocumentSequences: true}));
    assert.eq(
        usedDocumentSequences(getMoreResWithDocSeq),
        true,
        "getMore didn't use document sequences when flag passed to getMore but not aggregate");

    aggResWithDocSeq = assert.commandWorked(db.runCommand({
        aggregate: coll.getName(),
        pipeline: [{"$match": {stringField: "string"}}],
        cursor: {batchSize: 0},
        tempOptInToDocumentSequences: true
    }));

    assert.eq(usedDocumentSequences(aggResWithDocSeq),
              true,
              "aggregate did not utilize documentSequences when flag was provided");
    cursorId = aggResWithDocSeq.cursor.id;
    getMoreRes =
        assert.commandWorked(db.runCommand({getMore: cursorId, collection: coll.getName()}));
    assert.eq(usedDocumentSequences(getMoreRes),
              false,
              "getMore used document sequences when flag passed to aggregate but not getMore");

    aggResWithDocSeq = assert.commandWorked(db.runCommand({
        aggregate: coll.getName(),
        pipeline: [{"$match": {stringField: "string"}}],
        cursor: {batchSize: 0},
        tempOptInToDocumentSequences: true
    }));

    assert.eq(usedDocumentSequences(aggResWithDocSeq),
              true,
              "aggregate did not utilize documentSequences when flag was provided");
    cursorId = aggResWithDocSeq.cursor.id;
    getMoreResWithDocSeq = assert.commandWorked(db.runCommand(
        {getMore: cursorId, collection: coll.getName(), tempOptInToDocumentSequences: true}));
    assert.eq(usedDocumentSequences(getMoreResWithDocSeq),
              true,
              "getMore didn't use document sequences when flag passed to getMore and aggregate");

}());
