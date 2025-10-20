using System;
using System.Collections.Generic;
using MongoDB.Bson;
using MongoDB.Bson.IO;
using System.IO;
using MongoDB.Bson.Serialization;
using System.Linq;

namespace MongoDB.FTDC.Parser
{
    public class FTDCFile
    {
        public List<FTDCFileContents> Contents { get; internal set; } = new List<FTDCFileContents>();

        public DateTime MetricsStart { get; internal set; }
        public DateTime MetricsEnd { get; internal set; }

        /// <summary>
        /// Create a FTDCFile instance from the provided path
        /// </summary>
        /// <param name="path"></param>
        public FTDCFile(string path)
        {
            Open(path);
        }

        private void Open(String path)
        {
            // TODO - test for file/directory
            if (!File.Exists(path))
            {
                throw new FTDCException($"Cannot load ${path}");
            }

            using var sourceStream = new FileStream(path, FileMode.Open);
            using var reader = new BsonBinaryReader(sourceStream);
            while (!reader.IsAtEndOfFile())
            {
                var result = BsonSerializer.Deserialize<FTDCFileContents>(reader);

                // FIXME - we should only decompress the data we actually want to use, but this will
                // have to wait until we have timeseries parsing in place
                result.DecompressData();

                Contents.Add(result);
            }

            MetricsStart = Contents.Min(d => d._id);
            MetricsEnd = Contents.Max(d => d._id);
        }
    }
}