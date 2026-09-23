/* global db, print, quit, EJSON, _showAll */

var MIN_SAFE_FORMAT_VERSION = 13;
var EXCLUDED_DATABASES = ["admin", "config", "local"];
var PROBLEM_STATUSES = [
    "POTENTIALLY_PRE_42_UNIQUE_INDEX",
    "UNKNOWN_FORMAT_VERSION"
];
var EXIT_CODE_WITH_FINDINGS = 1;
var EXIT_CODE_WITH_ERRORS = 2;
var VALIDATE_ADVISORY = "Use `validate` as a secondary check, but note that the old-format warning is available starting in MongoDB 6.0. On versions below 6.0, `validate` may return no warning even when the risk remains. Because `validate` obtains an exclusive lock on the collection, it blocks reads and writes until it completes; when run on a secondary, it may block other operations on that secondary. It is resource-intensive, so run it with caution.";
var LEGACY_INDEX_ADVISORY = "This index may have been created before MongoDB 4.2 and may still use a legacy unique-index key format. " + VALIDATE_ADVISORY;
var UNKNOWN_VERSION_ADVISORY = "Unable to determine the index format version from collStats index details. " + VALIDATE_ADVISORY;

if (typeof _showAll === "undefined") {
    var _showAll = false;
}

(function () {
    "use strict";

    function isProblemStatus(status) {
        return PROBLEM_STATUSES.indexOf(status) !== -1;
    }

    function formatCommandError(label, response) {
        var detail = response && (response.codeName || response.code);

        return label + " failed: " + ((response && response.errmsg) || "unknown error") +
            (detail ? " (" + detail + ")" : "");
    }

    function getFormatVersionFromValue(value) {
        // Dates coerce to an epoch-millisecond integer, so reject them before any numeric conversion.
        if (Object.prototype.toString.call(value) === "[object Date]") {
            return null;
        }

        // Handles both Extended JSON wrappers and mongosh BSON numeric types.
        if (value && typeof value === "object") {
            if (value.$numberInt !== undefined) {
                value = value.$numberInt;
            } else if (value.$numberLong !== undefined) {
                value = value.$numberLong;
            } else if (value.$numberDouble !== undefined) {
                value = value.$numberDouble;
            } else if (typeof value.toNumber === "function") {
                value = value.toNumber();
            }
        }

        var version = Number(value);

        return Number.isInteger(version) ? version : null;
    }

    function getFormatVersion(indexDetail) {
        if (!indexDetail) {
            return null;
        }

        var value = indexDetail.formatVersion;

        if ((value === undefined || value === null) && indexDetail.metadata) {
            value = indexDetail.metadata.formatVersion;
        }

        return getFormatVersionFromValue(value);
    }

    function getCollectionNames(database) {
        var collectionNames = [];

        database.getCollectionInfos({}, {
            nameOnly: true,
            authorizedCollections: true
        }).forEach(function (collectionInfo) {
            // listCollections restricts filters to "name" for unprivileged users, so filter by type here.
            if (collectionInfo.type && collectionInfo.type !== "collection") {
                return;
            }

            if (collectionInfo.name.indexOf("system.") === 0) {
                return;
            }

            collectionNames.push(collectionInfo.name);
        });

        return collectionNames;
    }

    function getIndexDetails(database, collectionName) {
        var stats = database.runCommand({
            collStats: collectionName,
            indexDetails: true
        });

        if (!stats || !stats.ok) {
            throw new Error(formatCommandError("collStats", stats));
        }

        return stats;
    }

    function findIndexDetail(indexDetails, indexName) {
        if (!indexDetails) {
            return null;
        }

        if (Object.prototype.hasOwnProperty.call(indexDetails, indexName) && indexDetails[indexName]) {
            return indexDetails[indexName];
        }

        for (var detailName in indexDetails) {
            if (Object.prototype.hasOwnProperty.call(indexDetails, detailName)) {
                var detail = indexDetails[detailName];

                if (detail && detail.metadata && detail.metadata.name === indexName) {
                    return detail;
                }
            }
        }

        return null;
    }

    function getFormatVersions(stats, indexName) {
        var versions = {};
        var unknownLocations = [];

        if (stats.shards) {
            for (var shardName in stats.shards) {
                if (Object.prototype.hasOwnProperty.call(stats.shards, shardName)) {
                    var shardStats = stats.shards[shardName];
                    var shardVersion = getFormatVersion(findIndexDetail(shardStats.indexDetails, indexName));

                    if (shardVersion === null) {
                        unknownLocations.push(shardName);
                    } else {
                        versions[shardName] = shardVersion;
                    }
                }
            }
        } else {
            var topLevelVersion = getFormatVersion(findIndexDetail(stats.indexDetails, indexName));

            if (topLevelVersion === null) {
                unknownLocations.push("default");
            } else {
                versions.default = topLevelVersion;
            }
        }

        return {
            versions: versions,
            unknownLocations: unknownLocations
        };
    }

    function classifyFormatVersions(versions, unknownLocations) {
        var versionValues = Object.keys(versions).map(function (location) {
            return versions[location];
        });

        var hasLegacyVersion = versionValues.some(function (version) {
            return typeof version === "number" && version < MIN_SAFE_FORMAT_VERSION;
        });

        // A confirmed legacy location outranks an unknown one: the advisory is the same either way.
        if (hasLegacyVersion) {
            return "POTENTIALLY_PRE_42_UNIQUE_INDEX";
        }

        if (unknownLocations.length || versionValues.length === 0) {
            return "UNKNOWN_FORMAT_VERSION";
        }

        return "VALID";
    }

    function getAdvisory(status) {
        if (status === "POTENTIALLY_PRE_42_UNIQUE_INDEX") {
            return LEGACY_INDEX_ADVISORY;
        }

        if (status === "UNKNOWN_FORMAT_VERSION") {
            return UNKNOWN_VERSION_ADVISORY;
        }

        return null;
    }

    function buildSuggestedValidateCommand(databaseName, collectionName) {
        // Namespaces may contain newlines, which would break out of the quoted literal when pasted into mongosh.
        function escapeSingleQuotedLiteral(value) {
            return String(value)
                .replace(/\\/g, "\\\\")
                .replace(/'/g, "\\'")
                .replace(/\n/g, "\\n")
                .replace(/\r/g, "\\r")
                .replace(/\u2028/g, "\\u2028")
                .replace(/\u2029/g, "\\u2029");
        }

        var safeDatabaseName = escapeSingleQuotedLiteral(databaseName);
        var safeCollectionName = escapeSingleQuotedLiteral(collectionName);

        return "db.getSiblingDB('" + safeDatabaseName + "').getCollection('" + safeCollectionName + "').validate({full:true}).warnings";
    }

    function isCandidateIndex(indexSpec) {
        return indexSpec.unique === true && indexSpec.name !== "_id_";
    }

    // Callers must pre-filter index specs with isCandidateIndex.
    function validateIndex(databaseName, collectionName, indexSpec, stats) {
        var formatVersions = getFormatVersions(stats, indexSpec.name);
        var status = classifyFormatVersions(formatVersions.versions, formatVersions.unknownLocations);

        var advisory = getAdvisory(status);
        var result = {
            db: databaseName,
            collection: collectionName,
            namespace: databaseName + "." + collectionName,
            indexName: indexSpec.name || "<unnamed>",
            key: indexSpec.key || "<unknown key pattern>",
            formatVersions: formatVersions.versions,
            unknownLocations: formatVersions.unknownLocations,
            status: status
        };

        if (advisory) {
            result.advisory = advisory;
            result.suggestedValidateCommand = buildSuggestedValidateCommand(databaseName, collectionName);
        }

        return result;
    }

    function getUserDatabases() {
        var response = db.adminCommand({ listDatabases: 1, nameOnly: true });

        if (!response || !response.ok) {
            throw new Error(formatCommandError("listDatabases", response));
        }

        if (!Array.isArray(response.databases)) {
            throw new Error("listDatabases returned an unexpected response shape");
        }

        return response.databases.filter(function (databaseInfo) {
            return EXCLUDED_DATABASES.indexOf(databaseInfo.name) === -1;
        });
    }

    function collectFindings() {
        var results = [];
        var errors = [];
        var databases = getUserDatabases();

        function recordError(databaseName, collectionName, e) {
            var error = {
                scope: collectionName ? "collection" : "database",
                db: databaseName,
                error: e.message
            };

            if (collectionName) {
                error.collection = collectionName;
                error.namespace = databaseName + "." + collectionName;
            }

            errors.push(error);
        }

        databases.forEach(function (databaseInfo) {
            var currentDb = db.getSiblingDB(databaseInfo.name);
            var collectionNames;

            try {
                collectionNames = getCollectionNames(currentDb);
            } catch (e) {
                recordError(databaseInfo.name, null, e);
                return;
            }

            collectionNames.forEach(function (collectionName) {
                var candidateIndexes;
                var stats;

                try {
                    candidateIndexes = currentDb.getCollection(collectionName).getIndexes().filter(isCandidateIndex);
                } catch (e) {
                    recordError(databaseInfo.name, collectionName, e);
                    return;
                }

                if (!candidateIndexes.length) {
                    return;
                }

                try {
                    stats = getIndexDetails(currentDb, collectionName);
                } catch (e) {
                    recordError(databaseInfo.name, collectionName, e);
                    return;
                }

                candidateIndexes.forEach(function (indexSpec) {
                    results.push(validateIndex(databaseInfo.name, collectionName, indexSpec, stats));
                });
            });
        });

        return {
            results: results,
            errors: errors
        };
    }

    var audit;

    try {
        audit = collectFindings();
    } catch (e) {
        audit = {
            results: [],
            errors: [
                {
                    scope: "cluster",
                    error: e.message
                }
            ]
        };
    }

    var findings = _showAll
        ? audit.results
        : audit.results.filter(function (result) {
            return isProblemStatus(result.status);
        });
    var output = {
        checkedAt: new Date().toISOString(),
        minSafeFormatVersion: MIN_SAFE_FORMAT_VERSION,
        excludedDatabases: EXCLUDED_DATABASES,
        showAll: _showAll,
        totalUniqueIndexesChecked: audit.results.length,
        findings: findings,
        errors: audit.errors
    };
    var hasProblems = audit.results.some(function (result) {
        return isProblemStatus(result.status);
    });

    print(EJSON.stringify(output, null, 2));

    if (audit.errors.length) {
        quit(EXIT_CODE_WITH_ERRORS);
    }

    if (hasProblems) {
        quit(EXIT_CODE_WITH_FINDINGS);
    }
}());
