import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const products = Array.from({ length: 12 }).map((_, i) => ({
  id: i,
  name: `Product Item ${i + 1}`,
  price: (Math.random() * 100 + 10).toFixed(2),
  stock: Math.floor(Math.random() * 50),
  image: "/placeholder-product.jpg", 
  category: "Grocery"
}));

export function ProductGrid() {
  return (
    <ScrollArea className="flex-1 -mx-4 px-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-4">
        {products.map((product) => (
            <Card key={product.id} className="overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="aspect-square bg-muted relative">
                {/* <img
                src={product.image}
                alt={product.name}
                className="object-cover w-full h-full"
                /> */}
                <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-xs font-medium px-2 py-0.5 rounded-full">
                    {product.stock} in stock
                </div>
            </div>
            <div className="p-3 flex-1 flex flex-col gap-1">
                <h3 className="font-semibold text-sm truncate" title={product.name}>{product.name}</h3>
                <p className="text-muted-foreground text-xs">{product.category}</p>
                <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="font-bold text-primary">${product.price}</span>
                    <Button size="icon" className="h-8 w-8 rounded-full shrink-0">
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            </Card>
        ))}
        </div>
    </ScrollArea>
  );
}
