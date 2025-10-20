using CommandLine;
using System;
using MongoDB.FTDC.Parser;
using System.Linq;

namespace MongoDB.FTDC
{
    internal class Program
    {
        public class Options
        {
            [Option('v', "verbose", Required = false, HelpText = "Set output to verbose messages.")]
            public bool Verbose { get; set; }

            [Option('f', "file", Required = true, HelpText = "FTDC file to parse")]
            public string Filename { get; set; }

            [Option("limit-samples", Required = false, HelpText = "Limit # of samples to return")]
            public int LimitSamples { get; set; } = 0;

            [Option("skip-zero-samples", Required = false, HelpText = "Don't print metrics that have a value of zero")]
            public bool SkipZeroSamples { get; set; } = false;

            [Option("only-numeric-samples", Required = false, HelpText = "Don't print metrics that have a non-numberic value")]
            public bool OnlyNumericSamples { get; set; } = false;
        }

        private static void Main(string[] args)
        {
            args = new string[] {
                "-v", "true",
                "-f",
                @"C:\Temp\metrics.2019-12-22T17-34-22Z-00000",
                //@"C:\Users\Administrator\source\repos\MongoDB.FTDC\MongoDB.FTDC.Parser.Tests\diagnostic.data\metrics.2020-01-02T11-02-43Z-00000",
                "--limit-samples", "1",
                "--skip-zero-samples", "true"
            };

            CommandLine.Parser.Default.ParseArguments<Options>(args)
            .WithParsed<Options>(o =>
            {
                var ftdc = new FTDCFile(o.Filename);

                if (o.Verbose)
                {
                    Console.WriteLine("MongoDB FTDC Parser");
                    Console.WriteLine($"FTDC Samples: {ftdc.Contents.Count}");
                    Console.WriteLine($"Metrics Begin: {ftdc.MetricsStart}");
                    Console.WriteLine($"Metrics End:   {ftdc.MetricsEnd}");
                    var details = ftdc.Contents.First(d => d.type == 0).DocAsJson();
                    PrintFlattenedJson(details, o);
                }

                var q = ftdc.Contents.Where(d => d.type == 1);
                if (o.LimitSamples > 0)
                {
                    q = q.Take(o.LimitSamples);
                }
                q.ToList().ForEach(x => PrintFlattenedJson(x.DataAsJson(), o));
            });
        }

        private static void PrintFlattenedJson(string json, Options o)
        {
            var dict = JsonHelper.DeserializeAndFlatten(json);
            foreach (var kvp in dict)
            {
                if (o.OnlyNumericSamples && (kvp.Value.GetType() == typeof(String)))
                {
                    continue;
                }
                if (o.SkipZeroSamples && (kvp.Value.GetType() != typeof(String) && Convert.ToInt64(kvp.Value) == 0))
                {
                    continue;
                }
                Console.WriteLine(kvp.Key + ": " + kvp.Value);
            }
        }
    }
}