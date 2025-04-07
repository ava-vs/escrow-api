import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { File, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
// Temporarily commented out until products table implementation
// import { ProductsTable } from './products-table';
// import { getProducts } from '@/lib/db';

export default async function DashboardPage(
  props: {
    searchParams: Promise<{ q: string; offset: string }>;
  }
) {
  const searchParams = await props.searchParams;
  // Temporary placeholder data
  // Will be replaced with actual implementation when products table is available
  const search = searchParams.q ?? '';
  const offset = Number(searchParams.offset ?? 0);
  // const { products, newOffset, totalProducts } = await getProducts(search, offset);

  return (
    <Tabs defaultValue="all">
      <div className="flex items-center">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="archived" className="hidden sm:flex">
            Archived
          </TabsTrigger>
        </TabsList>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 gap-1">
            <File className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              Export
            </span>
          </Button>
          <Button size="sm" className="h-8 gap-1">
            <PlusCircle className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              Add Product
            </span>
          </Button>
        </div>
      </div>
      <TabsContent value="all">
        <div className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Скоро будет доступно</h2>
          <p className="text-gray-500">
            Функционал управления продуктами находится в разработке.
          </p>
        </div>
      </TabsContent>
    </Tabs>
  );
}
