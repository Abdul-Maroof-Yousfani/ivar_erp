import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const categories = [
  "All",
  "Grocery",
  "Pharmacy",
  "Beverages",
  "Snacks",
  "Personal Care",
  "Household",
  "Bakery",
  "Dairy",
  "Meat & Seafood"
];

export function ProductFilter() {
  return (
    <div className="flex items-center space-x-2">
        <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex w-max space-x-2 p-1">
                {categories.map((category) => (
                    <Button
                        key={category}
                        variant={category === "All" ? "default" : "secondary"}
                        size="sm"
                        className="rounded-full"
                    >
                        {category}
                    </Button>
                ))}
            </div>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>
    </div>
  );
}
