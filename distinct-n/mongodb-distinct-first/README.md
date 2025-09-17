# MongoDB Distinct-First

Helper function to dynamically generate aggregation pipelines for performing a distinct operation on N fields and returning the first document. This is similar to PostgreSQL’s: [SQL-DISTINCT](https://www.postgresql.org/docs/current/sql-select.html?#SQL-DISTINCT)

The script is written in a simple manner without external libraries and can be executed directly in `mongosh` as a function, making it easy to adapt to other languages or modify for specific distinct queries.

### Prerequisites

[MongoDB Shell (mongosh)](https://www.mongodb.com/docs/mongodb-shell/#welcome-to-mongodb-shell--mongosh-)

## Steps for General Distinct-N in MongoDB:

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

The contents of `distinctFirst.js` can be copied and pasted into a `mongosh` session, or loaded using:

```js
load("distinctFirst.js")
```

## Usage

```js
distinctFirst(
  "<collection name>",                      // string: collection name
  ["field1", "field2", ...],                // array: fields to group by
  { field1: 1, field2: 1, sortField: -1 },  // object: sort order (determines the "first" doc)
  { _id: 0, field1: 1, field2: 1, sortField: 1 }, // object: projection (if empty, returns full docs)
  { filterField: "someValue" }              // object: filter (optional)
);
```

## Examples:

### Example 1:

Returns the latest employee for each department and status.

**SQL:**

```sql
SELECT DISTINCT ON (department_id, employment_status)
       first_name, last_name, country, employee_id, hire_date
FROM employees
ORDER BY department_id, employment_status, hire_date DESC;
```

**MongoDB (distinctFirst):**

```js
distinctFirst(
  "employees",
  ["department_id", "employment_status"],
  { department_id: 1, employment_status: 1, hire_date: -1 },
  { _id: 0, first_name: 1, last_name: 1, country: 1, employee_id: 1, hire_date: 1 }
);
```

**Index:** `{department_id: 1, employment_status: 1, hire_date: -1}`

Obs: The latest `hire_date` document per group will be returned because of the `-1` descending sort order.

### Example 2:

Returns the first record for each visibility, stringID, and country combination.

**SQL:**

```sql
SELECT DISTINCT ON (access_level, product_code, region) *
FROM products
ORDER BY access_level, product_code, region, record_id ASC;
```

**MongoDB (distinctFirst):**

```js
distinctFirst(
  "products",
  ["access_level", "product_code", "region"],
  { access_level: 1, product_code: 1, region: 1, record_id: 1 },
  {}
);
```

**Index:** `{access_level: 1, product_code: 1, region: 1, record_id:1}`

Obs: The oldest `record_id` document per group will be returned due to the `1` ascending sort order.

### Example 3:

Returns the latest record per status, country location, department, and category in Germany.

**SQL:**

```sql
SELECT DISTINCT ON (order_status, region, department_id, product_category_id) *
FROM orders
WHERE country = 'Germany'
ORDER BY order_status, region, department_id, product_category_id, order_date DESC;
```

**MongoDB (distinctFirst):**

```js
distinctFirst(
  "orders",
  ["order_status", "region", "department_id", "product_category_id"],
  { order_status: 1, region: 1, department_id: 1, product_category_id: 1, order_date: -1 },
  {},
  { country: "Germany" }
);
```

**Index:** `{country: 1, order_status: 1, region: 1, department_id:1, product_category_id: 1, order_date: -1}`

Obs: adding the `country` filter field to the beginning to of the index ensures **DISTINCT_SCAN** however it may cause additional Index Keys to be scanned.

### Example 4:

Returns the latest releaseDate for each status and stringID where minutes > 30.

**SQL:**

```sql
SELECT DISTINCT ON (shipment_status, tracking_code)
       shipment_status, tracking_code, shipped_date
FROM shipments
WHERE transit_time_minutes > 30
ORDER BY shipment_status, tracking_code, shipped_date DESC;
```

**MongoDB (distinctFirst):**

```js
distinctFirst(
  "shipments",
  ["shipment_status", "tracking_code"],
  { shipment_status: 1, tracking_code: 1, shipped_date: -1 },
  { _id: 0, shipment_status: 1, tracking_code: 1, shipped_date: 1 },
  { transit_time_minutes: { $gt: 30 }, shipment_status: { $gte: MinKey() } }
);
```

**Index:** `{shipment_status: 1, tracking_code: 1, shipped_date: -1, transit_time_minutes:1}`

Obs: because it is a range filter `transit_time_minutes` has been added as the latest field of the index to ensure the utilization of **DISTINCT_SCAN**. More details can be found on <THE KB n2.>

## Batches

A batch size of 400 stages per pipeline has been set to the script, because exceeding 1000 stages generates the following MongoDB error:

```js
MongoServerError: Pipeline length must be no longer than 1000 stages.
```

## Upcoming Features

- Reduce payload execution on the client side.
- Add a comprehensive debug option.
- Add the ability to spool results to a target collection using `$out`.
- Additional filters to allow for more dynamic queries.

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
