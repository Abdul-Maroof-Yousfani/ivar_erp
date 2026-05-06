export default function TestDepartmentPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-green-600">✅ Department Test Page</h1>
      <p className="mt-4">If you can see this page, the routing is working correctly!</p>
      <p className="mt-2"><strong>Current URL:</strong> master.localtest.me:3001/department/test</p>
      <p className="mt-2"><strong>Internal path:</strong> /master/department/test</p>
      
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
        <h2 className="font-semibold text-blue-800">Debug Info:</h2>
        <p className="text-blue-700">This is a simple test page without any API calls or complex logic.</p>
        <p className="text-blue-700">If this loads but /department/list doesn't, the issue is with the list page itself.</p>
      </div>
      
      <div className="mt-4">
        <a 
          href="/department/list" 
          className="text-blue-600 hover:text-blue-800 underline"
        >
          Try navigating to Department List
        </a>
      </div>
    </div>
  );
}