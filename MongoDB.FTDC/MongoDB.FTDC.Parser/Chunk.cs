using MongoDB.Bson;
using System;
using System.Collections.Generic;
using System.Text;

namespace MongoDB.FTDC.Parser
{
    public class Chunk
    {
        public long TMin { get; internal set; }
        public long TMax { get; internal set; }

        public BsonDocument ReferenceDoc { get; internal set; }
        public int NumKeys { get; internal set; }
        public int NumDeltas { get; internal set; }

        public byte[] Deltas { get; internal set; }
    }
}