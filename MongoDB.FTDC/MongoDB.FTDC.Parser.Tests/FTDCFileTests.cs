using Microsoft.VisualStudio.TestTools.UnitTesting;
using Shouldly;
using System;

namespace MongoDB.FTDC.Parser.Tests
{
    [TestClass]
    public class FTDCFileTests
    {
        [TestMethod]
        public void FileOpenShouldFailWithInvalidPath()
        {
            Should.Throw<FTDCException>(() => new FTDCFile("..."));
        }

        [TestMethod]
        public void FileOpenShouldLoadAValidPath()
        {
            var ftdc = new FTDCFile(@"diagnostic.data\metrics.2020-01-02T11-02-43Z-00000");
            ftdc.Contents.Count.ShouldNotBe(0);
        }

        [TestMethod]
        public void ParsedFTDCFileShouldDecodeData()
        {
            var ftdc = new FTDCFile(@"diagnostic.data\metrics.2020-01-02T11-02-43Z-00000");
            ftdc.Contents.Count.ShouldNotBe(0);

            Should.NotThrow(() => ftdc.Contents[1].DecompressData());
        }

        [TestMethod]
        public void ParsedFTDCFileShouldContainTimespan()
        {
            var ftdc = new FTDCFile(@"diagnostic.data\metrics.2020-01-02T11-02-43Z-00000");

            ftdc.MetricsStart.ToString().ShouldBe("1/2/2020 11:02:43 AM");
            ftdc.MetricsEnd.ToString().ShouldBe("1/2/2020 3:19:56 PM");
        }
    }
}