import Link from "next/link";

const experiments = [
  { id: 1, title: "connect to db", href: "/experiments/connect-to-db" },
  { id: 2, title: "chat with table", href: "/experiments/natural-language-to-sql" },
  { id: 3, title: "chart.js generation", href: "/experiments/chart-js-generation" },
  { id: 4, title: "query generation", href: "/experiments/query-generation" },
  { id: 5, title: "ERD generator", href: "/experiments/join-tables" },
];

export default function Experiments() {
  return (
    <div className="min-h-screen">
      <div className="p-6">
        <h1 className="text-4xl mb-8">experiments</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-7xl">
          {experiments.map((experiment) => {
            const className = "border border-gray-300 dark:border-gray-700 rounded-lg p-6 hover:border-gray-400 dark:hover:border-gray-600 transition-colors block";
            
            if (experiment.href) {
              return (
                <Link
                  key={experiment.id}
                  href={experiment.href}
                  className={`${className} cursor-pointer`}
                >
                  <h3 className="text-lg">{experiment.title}</h3>
                </Link>
              );
            }
            
            return (
              <div
                key={experiment.id}
                className={className}
              >
                <h3 className="text-lg">{experiment.title}</h3>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

