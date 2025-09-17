/**
 * Retrieves distinct combinations of fields from a MongoDB collection,
 * similar to Postgres DISTINCT ON, with optional sorting, projection, and filtering.
 *
 * @param {string} collName - The collection name.
 * @param {string[]} distinctOnFields - Array of fields to get distinct combinations on.
 * @param {object} sort - Sort order for selecting the "top" document per combination.
 * @param {object} projection - Additional fields to include in the final output.
 * @param {object} match - Optional filter object to apply to all $match stages.
 */
async function distinctFirst(collName, distinctOnFields, sort, projection = {}, match = {}) {
  if (!distinctOnFields || distinctOnFields.length === 0) {
    print("No fields specified.");
    return;
  }

  const coll = db[collName];
  const BATCH_SIZE = 400; 

  const firstField = distinctOnFields[0];
  const initialProjection = { _id: 0, [firstField]: 1 };

  // Step 1: Get distinct values for the first field
  let knownCombos = await coll.aggregate([
    { $match: match },
    { $sort: sort },
    { $group: { _id: `$${firstField}`, topEntry: { $first: "$$ROOT" } } },
    { $replaceRoot: { newRoot: "$topEntry" } },
    { $project: initialProjection }
  ]).toArray();

  // Step 2: Loop over remaining fields to build combinations
  for (let i = 1; i < distinctOnFields.length; i++) {
    const currentField = distinctOnFields[i];
    const previousFields = distinctOnFields.slice(0, i);
    let newCombos = [];

    for (let batchStart = 0; batchStart < knownCombos.length; batchStart += BATCH_SIZE) {
      const batch = knownCombos.slice(batchStart, batchStart + BATCH_SIZE);

      const unionPipelines = batch.map(combo => {
        const matchFilter = Object.assign({}, match);
        previousFields.forEach(f => matchFilter[f] = combo[f]);

        const fieldsToKeep = [...previousFields, currentField];

        // Build projection only if user actually passed fields
        let finalProjection = {};
        if (projection && Object.keys(projection).length > 0) {
          finalProjection = Object.assign({}, projection);
          fieldsToKeep.forEach(f => finalProjection[f] = 1);
        }

        const subPipeline = [
          { $match: matchFilter },
          { $sort: sort },
          { $group: { _id: `$${currentField}`, topEntry: { $first: "$$ROOT" } } },
          { $replaceRoot: { newRoot: "$topEntry" } }
        ];

        if (Object.keys(finalProjection).length > 0) {
          subPipeline.push({ $project: finalProjection });
        }

        return subPipeline;
      });

      const pipeline = unionPipelines.reduce((acc, p, index) => {
        if (index === 0) return p;
        acc.push({ $unionWith: { coll: collName, pipeline: p } });
        return acc;
      }, []);

      const batchResults = await coll.aggregate(pipeline).toArray();
      newCombos = newCombos.concat(batchResults);
    }

    knownCombos = newCombos;
  }
  printjson(knownCombos);
}
