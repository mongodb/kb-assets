# Index Format Validation

Checks unique non-`_id_` indexes across all non-system databases for legacy storage engine index format versions that may cause migration issues.

The checker assumes unique indexes with a WiredTiger index `formatVersion` below `13` were created on MongoDB versions earlier than 4.2, or otherwise still use a legacy on-disk format. Indexes with `formatVersion` `13` or newer are reported as valid.

## Usage

Requires `mongosh` and MongoDB 4.0 or newer.

```bash
mongosh "<connection-string>" indexFormatValidation.js
```

By default, the script checks all collections in all databases except `admin`, `config`, and `local`. It prints only indexes that need review.

To include valid unique indexes in the output, set `_showAll=true`:

```bash
mongosh "<connection-string>" --eval 'var _showAll=true' indexFormatValidation.js
```

Exit codes:

- `0`: no suspicious indexes found and no runtime errors
- `1`: one or more suspicious indexes found
- `2`: runtime or permission errors were encountered while scanning

## Source Data

The script reads directly from the connected deployment using:

- `listDatabases` with `nameOnly: true` to find databases
- `getCollectionInfos({}, { nameOnly: true, authorizedCollections: true })` to find collections
- `getIndexes()` to find unique index specs
- `collStats` with `indexDetails: true` to read WiredTiger index metadata

System databases `admin`, `config`, and `local` are skipped, along with views, timeseries collections (which cannot have unique indexes), and collections whose names start with `system.`.

Collections are listed with `authorizedCollections: true`, so a user without cluster-wide `listCollections` privileges still gets a scan across the collections they are authorized to read. That mode restricts server-side filters to `name`, so the collection type is filtered client-side.

The script checks `formatVersion` or `metadata.formatVersion` from the `collStats` index details. Plain `db.collection.getIndexes()` output is not sufficient by itself because its `v` field is the index spec version, not the WiredTiger `formatVersion` checked by this script.

## Output

Each finding includes:

- `namespace`
- `indexName`
- `key`
- `formatVersions`
- `unknownLocations`
- `status`
- `suggestedValidateCommand` (only for suspicious findings)
- `advisory` (only for suspicious findings)

For sharded collections, `formatVersions` contains one entry per shard that reported a parseable version, and `unknownLocations` lists the shards that did not.

For standalone nodes and replica sets, `formatVersions.default` contains the reported version. If the version cannot be determined, `unknownLocations` contains `default`.

Statuses:

- `POTENTIALLY_PRE_42_UNIQUE_INDEX`: unique index has `formatVersion` lower than `13`
- `UNKNOWN_FORMAT_VERSION`: unique index is missing a parseable `formatVersion` in at least one location
- `VALID`: unique index has `formatVersion` `13` or newer in every location, shown only when `_showAll=true`

On sharded clusters, `UNKNOWN_FORMAT_VERSION` for a subset of shards is often benign: the index may still be building, or the shard may report no index details. Use `unknownLocations` to identify which shards to re-check.

Each entry in `errors` includes:

- `scope`: `cluster`, `database`, or `collection`
- `db` (not present for `cluster` scope)
- `collection` and `namespace` (only for `collection` scope)
- `error`

For a failed command, `error` reads `<command> failed: <errmsg> (<codeName or code>)` using the fields the server returned. A `listDatabases` call that succeeds but returns an unexpected payload is reported separately as `listDatabases returned an unexpected response shape`.

The script calls `getIndexes()` for every scanned collection. If a collection has no unique non-`_id_` indexes, `collStats` is not run for that collection, so `collStats` permission errors on those namespaces are not reported.

When a suspicious index is found, the `advisory` field is included with guidance to run `validate` as a secondary check. The old unique-index-format warning from `validate` is available starting in MongoDB 6.0; on older versions, `validate` may return no warning even when the risk remains. Because `validate` obtains an exclusive lock on the collection, it blocks reads and writes until it completes; when run on a secondary, it may block other operations on that secondary. It is resource-intensive, so run it with caution.

The `suggestedValidateCommand` field includes a ready-to-run sample in this format:

`db.getSiblingDB('database_name').getCollection('collection_name').validate({full:true}).warnings`