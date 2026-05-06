import { getEmployeesForDropdown } from "@/lib/actions/employee";
import { getDepartments } from "@/lib/actions/department";
import { getRequestForwardingByType, type RequestForwardingConfiguration } from "@/lib/actions/request-forwarding";
import { RequestForwardingClient } from "./request-forwarding-client";

type RequestType =
  | "exemption"
  | "attendance"
  | "advance-salary"
  | "loan"
  | "overtime"
  | "leave-application"
  | "leave-encashment";

interface PageProps {
  searchParams: Promise<{ type?: string }>;
}

function validateRequestType(type: string | undefined): RequestType {
  if (type === "exemption" || type === "attendance" || type === "advance-salary" || type === "loan" || type === "overtime" || type === "leave-application" || type === "leave-encashment") {
    return type;
  }
  return "attendance";
}

export default async function RequestForwardingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const requestType = validateRequestType(params.type);

  // Fetch common data and only the active tab's configuration
  const [employeesResult, departmentsResult, configResult] = await Promise.all([
    getEmployeesForDropdown(),
    getDepartments(),
    getRequestForwardingByType(requestType),
  ]);

  const employees = employeesResult.status && employeesResult.data ? employeesResult.data : [];
  const departments = departmentsResult.status && departmentsResult.data ? departmentsResult.data : [];
  const config: RequestForwardingConfiguration | null =
    configResult.status && configResult.data ? configResult.data : null;

  return (
    <RequestForwardingClient
      key={requestType}
      employees={employees}
      departments={departments}
      initialRequestType={requestType}
      initialConfig={config}
    />
  );
}
