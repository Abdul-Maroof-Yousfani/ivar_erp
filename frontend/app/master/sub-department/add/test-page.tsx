export default function TestSubDepartmentPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Sub-Department Add Page Test</h1>
      <p>If you can see this page, the sub-department routing is working!</p>
      <p>Current URL should be: master.localtest.me:3001/sub-department/add</p>
      <p>Internal path: /master/sub-department/add</p>
      
      <div className="mt-4 p-4 bg-gray-100 rounded">
        <h2 className="font-semibold">Debug Info:</h2>
        <p>This is a test page to verify routing works before adding API calls.</p>
      </div>
    </div>
  );
}