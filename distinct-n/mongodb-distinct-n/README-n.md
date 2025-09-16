# MongoDB Distinct-N

Helper function to dynamically generate Aggregation Pipelines to perform a _distinct_ operation across N fields.

The script is written in a simple manner without external libraries and can be executed directly in `mongosh` as a function, making it easy to adapt to other languages or modify for specific distinct queries.

### Prerequisites

[MongoDB Shell (mongosh)](https://www.mongodb.com/docs/mongodb-shell/#welcome-to-mongodb-shell--mongosh-)

## Steps for Distinct-N in MongoDB

1. **Get distinct values for the first field (`A`)**
   - Suppose the fields are `A`, `B`, `C`, and `D`. For this step, retrieve the _distinct_ values of field `A`.
2. **Iteratively find distinct combinations**
   - For each combination of known fields `(A), (A,B) until (A,B,C)`:
     - Add a `$match` fixing those known field values.
     - Add a `$group` on the _next_ field to enumerate its distinct values.
     - Use `$project` to preserve the known fields along with the new one.
     - Encapsulate each remaining known distinct groups with `$unionWith`.
   - Repeat this process until the last field is reached.
3. **Execute the final Aggregation Pipeline**
   - A final aggregation pipeline, where each branch is combined using `$unionWith`, will produce the distinct groups of `(A, B, C)` against `(D)`.

## Heuristics

- **This script is only optimal when combining fields with low cardinality.** Including high cardinality fields (such as unique identifiers, date fields, or IDs) may cause the number of inner Aggregation Pipelines to increase uncontrollably, potentially resulting in more Index Key scans than a `COLLSCAN`. This can lead to serious performance issues.
- **It is recommended to assess field cardinality before running the aggregation pipeline.** Use manual `distinct` or aggregation commands like `[ { $group: { _id: "$<field>" } }, { $count: "countDistinct" } ]` to identify the number of unique values in each field.
- **Selecting the lowest cardinality fields order typically results in less Index Keys examined,** but keeping in mind that each dataset may behave differently. Testing and validation is recommended.

## Advisory

1. This approach lacks the built-in safeguards of a standalone `$group` stage. Each sub-pipeline behaves independently, and including high-cardinality fields may lead to errors or long-running executions.
2. This script has not been validated against edge cases.
3. This script is **not recommended for production**. It serves as a starting point and a data analysis tool, intended to be further developed and adapted.
4. If testing against another database system, consider differences in data type handling and sort order across versions, for example MongoDB may treat null values differently.

## Installing

The contents of `distinctN.js` can be copied and pasted into a `mongosh` session, or loaded using:

```js
load("distinctN.js")
```

## Usage

```js
distinctN('<collection name>', ['field1', 'field2', ... 'fieldN']);
```

**Expected Result:**

```js
[
  { field1: 'A', field2: 'B', field3: 'A' },
  { field1: 'A', field2: 'A', field3: 'C' },
  { field1: 'A', field2: 'A', field3: 'B' }
]
```

## Options

### Count Distinct:

- `false (default)` – Return only the distinct groups.
- `true` – Return an array of distinct field combinations, with the last document including the count.
- `"only"` – Return a single document containing the total number of distinct combinations.

**{ count: true }**

```js
distinctN('<collection name>', ['field1', 'field2', ... 'fieldN'], { count: true });
```

**Expected Result:**

```js
[
  { field1: 'A', field2: 'B', field3: 'A' },
  { field1: 'A', field2: 'A', field3: 'C' },
  { field1: 'A', field2: 'A', field3: 'B' },
  { countDistinct: 3 }
]
```

**{ count: "only" }**

```js
distinctN('<collection name>', ['field1', 'field2', ... 'fieldN'], { count: "only" });
```

**Expected Result:**

```js
[
  { countDistinct: 3 }
]
```

## Formula to Estimate the Number of Index Keys Examined

### Definitions

Let \(d_1, d_2, \dots, d_N\) be the **distinct counts** of each field.

Let \(G_i\) be the **number of distinct groups up to layer \(i\)**:

\[
\begin{aligned}
G_1 &= d_1 \\
G_2 &= d_1 \cdot d_2 \\
G_3 &= d_1 \cdot d_2 \cdot d_3 \\
&\dots \\
G_N &= d_1 \cdot d_2 \cdot \dots \cdot d_N
\end{aligned}
\]

### Layer Keys Examined

- **Layer 1 (first field):**

\[
\text{Layer}_1 = d_1
\]

- **Layer \(i\) (for \(i \ge 2\)):**

\[
\text{Layer}_i = (G_{i-1} - 1) \cdot (d_i + 1) + d_i
\]

### Total Keys Examined

\[
\text{Total keys examined} = \sum_{i=1}^{N} \text{Layer}_i
\]

### Example: \([3,3,4,3]\)

\[
\begin{aligned}
G_1 &= 3, \quad G_2 = 3 \cdot 3 = 9, \quad G_3 = 3 \cdot 3 \cdot 4 = 36, \quad G_4 = 3 \cdot 3 \cdot 4 \cdot 3 = 108 \\
\text{Layer}_1 &= 3 \\
\text{Layer}_2 &= (3-1) \cdot (3+1) + 3 = 11 \\
\text{Layer}_3 &= (9-1) \cdot (4+1) + 4 = 44 \\
\text{Layer}_4 &= (36-1) \cdot (3+1) + 3 = 143 \\
\text{Total keys examined} &= 3 + 11 + 44 + 143 = 201
\end{aligned}
\]

### Helper

```js
function keysExamined(distinctCounts) {
  const layers = [];

  // Layer 1
  layers[0] = distinctCounts[0];
  let prevGroups = distinctCounts[0]; // number of distinct groups in previous layer

  for (let i = 1; i < distinctCounts.length; i++) {
    const d = distinctCounts[i];
    const layerSum = (prevGroups - 1) * (d + 1) + d;
    layers[i] = layerSum;

    // Update prevGroups for next layer
    prevGroups *= d; // number of distinct groups = product of previous * current
  }

  const total = layers.reduce((a,b)=>a+b,0);
  return { layers, total };
}
```

### Sample

```js
console.log(keysExamined([3, 3, 4, 3]));
```

### Output

```js
{ layers: [ 3, 11, 44, 143 ], total: 201 }
```

## Batches

A batch size of 400 stages per pipeline has been set to the script, because exceeding 1000 stages generates the following MongoDB error:

```js
MongoServerError: Pipeline length must be no longer than 1000 stages.
```

## Upcoming Features

- Filtering with a `$match` stage.
- Reduce payload execution on the client side.
- Add a comprehensive debug option.
- Add the ability to spool results to a target collection using `$out`.

## License

[Apache 2.0](http://www.apache.org/licenses/LICENSE-2.0)

## DISCLAIMER

Please note: all tools/ scripts in this repo are released for use "AS IS" **without any warranties of any kind**,
including, but not limited to their installation, use, or performance.  We disclaim any and all warranties, either
express or implied, including but not limited to any warranty of noninfringement, merchantability, and/ or fitness
for a particular purpose.  We do not warrant that the technology will meet your requirements, that the operation
thereof will be uninterrupted or error-free, or that any errors will be corrected.

Any use of these scripts and tools is **at your own risk**.  There is no guarantee that they have been through
thorough testing in a comparable environment and we are not responsible for any damage or data loss incurred with
their use.

You are responsible for reviewing and testing any scripts you run *thoroughly* before use in any non-testing
environment.

Thanks,
The MongoDB Support Team