/**
 * Retrieves distinct combinations of N fields from a MongoDB collection
 *
 * @param {string} collName - The name of the MongoDB collection.
 * @param {string[]} fields - Array of fields to get distinct combinations on.
 * @param {object} [options] - Optional settings.
 * @param {boolean|string} [options.count=false] - If true, appends `countDistinct` to the result; if "only", returns only the count.
 */
async function distinctN(collName, fields, { count = false } = {}) {
  if (!fields || fields.length === 0) {
    print("No fields specified.");
    return;
  }

  const coll = db[collName];
  const BATCH_SIZE = 20000;

  // Step 1: Get distinct values for the first field
  let distinctSet = await coll.aggregate([
    { $group: { _id: `$${fields[0]}` } },
    { $project: { _id: 0, [fields[0]]: "$_id" } }
  ]).toArray();

  // Loop over remaining fields
  for (let i = 1; i < fields.length; i++) {
    const field = fields[i];
    const prevFields = fields.slice(0, i);

    let nextSet = [];

    // Process distinctSet in batches
    for (let batchStart = 0; batchStart < distinctSet.length; batchStart += BATCH_SIZE) {
      const batch = distinctSet.slice(batchStart, batchStart + BATCH_SIZE);

      // Build union pipelines for batch
      const unionPipelines = batch.map(setItem => {
        const matchFilter = {};
        for (const pf of prevFields) {
          matchFilter[pf] = setItem[pf];
        }

        // Build project stage directly (no $set)
        const projectStage = Object.assign(
          { _id: 0 },
          ...prevFields.map(pf => ({ [pf]: setItem[pf] })), // carry constants
          { [field]: "$_id" }
        );

        return [
          { $match: matchFilter },
          { $group: { _id: `$${field}` } },
          { $project: projectStage }
        ];
      });

      // Compose pipeline with chained unionWith
      let pipeline = unionPipelines.length > 0 ? unionPipelines[0] : [];
      for (let j = 1; j < unionPipelines.length; j++) {
        pipeline.push({ $unionWith: { coll: collName, pipeline: unionPipelines[j] } });
      }

      // Run aggregation for this batch
      const batchResults = await coll.aggregate(pipeline).toArray();
      nextSet = nextSet.concat(batchResults);
    }

    distinctSet = nextSet;
  }

  // Handle count options
  if (count === "only") {
    printjson({ countDistinct: distinctSet.length });
    return;
  } else if (count === true) {
    distinctSet.push({ countDistinct: distinctSet.length });
  }

  // Print final result
  printjson(distinctSet);
}