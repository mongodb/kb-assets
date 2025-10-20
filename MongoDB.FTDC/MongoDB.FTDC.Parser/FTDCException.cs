using System;
using System.Collections.Generic;
using System.Text;

namespace MongoDB.FTDC.Parser
{
    public class FTDCException : Exception
    {
        public FTDCException(string message) : base(message)
        {
        }

        public FTDCException()
        {
        }

        public FTDCException(string message, Exception innerException) : base(message, innerException)
        {
        }
    }
}