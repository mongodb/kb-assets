using ICSharpCode.SharpZipLib.Zip.Compression.Streams;
using MongoDB.Bson;
using MongoDB.Bson.IO;
using MongoDB.Bson.Serialization;
using System;
using System.IO;

namespace MongoDB.FTDC.Parser
{
    public class FTDCFileContents
    {
        public DateTime _id { get; set; }
        public int type { get; set; }
        public BsonDocument doc { get; set; }
        public BsonBinaryData data { get; set; }

        private BsonDocument DecompressedData { get; set; }

        public void DecompressData()
        {
            // sanity check
            if (type != 1)
                return;

            byte[] raw = data.AsByteArray;
            byte[] compressed = new byte[raw.Length - 4];
            Array.Copy(raw, 4, compressed, 0, compressed.Length);

            using var outputStream = new MemoryStream();
            using (var compressedStream = new MemoryStream(compressed))
            using (var inputStream = new InflaterInputStream(compressedStream))
            {
                inputStream.CopyTo(outputStream);
                outputStream.Position = 0;
            }

            DecompressedData = BsonSerializer.Deserialize<BsonDocument>(outputStream.ToArray());
        }

        public string DataAsJson()
        {
            var s = new JsonWriterSettings { OutputMode = JsonOutputMode.Strict };
            return (DecompressedData != null) ? DecompressedData.ToJson(s) : String.Empty;
        }

        public string DocAsJson()
        {
            var s = new JsonWriterSettings { OutputMode = JsonOutputMode.Strict };
            return (doc != null) ? doc.ToJson(s) : String.Empty;
        }
    }
}