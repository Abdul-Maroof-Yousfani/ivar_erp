"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarIcon, Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Autocomplete } from "@/components/ui/autocomplete";

import { createTransfer } from "@/lib/actions/transfer";
import { getEmployeeById, type EmployeeDropdownOption } from "@/lib/actions/employee";
import { type Location } from "@/lib/actions/location";
import { type State, type City, getCitiesByCountry, getStatesByCountry, getCitiesByState, getStates } from "@/lib/actions/city";

interface TransferFormProps {
    employees: EmployeeDropdownOption[];
    locations: Location[];
    states: State[]; // Initial states (maybe all or empty?)
    // Actually, states and cities depend on country. Usually we assume one country or fetch based on selection.
    // For simplicity, we can pass all active states/cities or let component fetch.
    // Given the complexity, letting component fetch states/cities is better.
    countries?: any[];
}

export function TransferForm({ employees, locations }: TransferFormProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const paramEmployeeId = searchParams.get("employeeId");

    const [loading, setLoading] = useState(false);
    const [fetchingEmployee, setFetchingEmployee] = useState(false);

    // Form State
    const [selectedEmployeeId, setSelectedEmployeeId] = useState(paramEmployeeId || "");

    // Sync state with param in case of navigation updates
    useEffect(() => {
        if (paramEmployeeId) {
            setSelectedEmployeeId(paramEmployeeId);
        }
    }, [paramEmployeeId]);
    const [transferDate, setTransferDate] = useState<Date>(new Date());
    const [newLocationId, setNewLocationId] = useState("");
    const [newCityId, setNewCityId] = useState("");
    const [newStateId, setNewStateId] = useState("");
    const [reason, setReason] = useState("");

    // Data State
    const [currentEmployee, setCurrentEmployee] = useState<any>(null);
    const [states, setStates] = useState<State[]>([]);
    const [cities, setCities] = useState<City[]>([]);

    // Combobox state
    const [openEmployee, setOpenEmployee] = useState(false);

    // Fetch states/cities based on defaults or user selection
    // Assuming 'Pakistan' or default country for now, or just fetch all states if count is low. 
    // Let's rely on fetching states by country if we have country.
    // Or fetch all states if no country context.
    // Optimization: Fetch all states once.

    // Effect: Fetch states on mount (assuming single country context or fetch all)
    // For now, let's load states for the default country (Pakistan commonly in this app context?) or just all active states.
    // The props `states` are not passed, so I'll fetch them.
    // Let's add states to props or fetch inside. I'll fetch inside.

    const fetchStates = async (countryId: string) => {
        const res = await getStatesByCountry(countryId);
        if (res.status && res.data) {
            setStates(res.data);
        }
    };

    const fetchCities = async (stateId: string) => {
        const res = await getCitiesByState(stateId);
        if (res.status && res.data) {
            setCities(res.data);
        }
    };

    // When Employee is selected
    useEffect(() => {
        if (selectedEmployeeId) {
            const fetchDetails = async () => {
                setFetchingEmployee(true);
                setCurrentEmployee(null);
                try {
                    const res = await getEmployeeById(selectedEmployeeId);
                    if (res.status && res.data) {
                        setCurrentEmployee(res.data);

                        // If employee has country, fetch states for that country
                        if (res.data.country) {
                            fetchStates(res.data.country);
                        }
                    }
                } catch (error) {
                    console.error(error);
                    toast.error("Failed to fetch employee details");
                } finally {
                    setFetchingEmployee(false);
                }
            };
            fetchDetails();
        } else {
            setCurrentEmployee(null);
        }
    }, [selectedEmployeeId]);

    // Fetch all states on mount
    useEffect(() => {
        const initStates = async () => {
            try {
                const res = await getStates();
                if (res.status && res.data) {
                    setStates(res.data);
                }
            } catch (e) {
                console.error("Failed to load states", e);
            }
        };
        initStates();
    }, []);

    // If New Location is selected, try to auto-set City/State
    useEffect(() => {
        if (newLocationId) {
            const loc = locations.find(l => l.id === newLocationId);
            if (loc && loc.cityId) {
                setNewCityId(loc.cityId);
                // Also need to set State. 
                // Location -> City -> State.
                // If `loc.city` is populated (it is in `Location` interface), we can get stateId.
                if (loc.city && loc.city.stateId) {
                    setNewStateId(loc.city.stateId); // Auto set state
                    fetchCities(loc.city.stateId); // Load cities for this state
                }
            }
        }
    }, [newLocationId, locations]);

    // If State changes manually, fetch cities
    useEffect(() => {
        if (newStateId) {
            fetchCities(newStateId);
        } else {
            setCities([]);
        }
    }, [newStateId]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmployeeId || !newLocationId || !transferDate) {
            toast.error("Please fill in all required fields");
            return;
        }

        setLoading(true);
        try {
            const res = await createTransfer({
                employeeId: selectedEmployeeId,
                transferDate: transferDate.toISOString(),
                newLocationId,
                newCityId: newCityId || undefined,
                newStateId: newStateId || undefined,
                reason,
            });

            if (res.status) {
                toast.success(res.message);
                router.push("/hr/employee/list");
            } else {
                toast.error(res.message);
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Transfer Details</CardTitle>
                    <CardDescription>Select employee and new location details.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">

                        {/* Employee Selection */}
                        <div className="flex flex-col space-y-2">
                            <Label>Select Employee</Label>
                            <Popover open={openEmployee} onOpenChange={setOpenEmployee}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openEmployee}
                                        className="w-full justify-between"
                                    >
                                        {selectedEmployeeId
                                            ? employees.find((e) => e.employeeId === selectedEmployeeId)?.employeeName ||
                                            employees.find((e) => e.id === selectedEmployeeId)?.employeeName
                                            : "Search employee..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[400px] p-0">
                                    <Command>
                                        <CommandInput placeholder="Search employee..." />
                                        <CommandList>
                                            <CommandEmpty>No employee found.</CommandEmpty>
                                            <CommandGroup>
                                                {employees.map((employee) => (
                                                    <CommandItem
                                                        key={employee.id}
                                                        value={employee.employeeName}
                                                        onSelect={() => {
                                                            setSelectedEmployeeId(employee.id); // Use UUID
                                                            setOpenEmployee(false);

                                                            // Update URL
                                                            const params = new URLSearchParams(searchParams.toString());
                                                            params.set("employeeId", employee.id);
                                                            router.push(`?${params.toString()}`);
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                selectedEmployeeId === employee.id ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {employee.employeeName} ({employee.employeeId})
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Current Details Display */}
                        {fetchingEmployee && <div className="text-sm text-muted-foreground flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading details...</div>}

                        {currentEmployee && (
                            <div className="bg-muted/50 p-4 rounded-md space-y-2 text-sm">
                                <h4 className="font-semibold mb-2">Current Posting</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="text-muted-foreground">Location:</span>
                                        <p className="font-medium">{currentEmployee.locationName || "N/A"}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">City:</span>
                                        <p className="font-medium">{currentEmployee.cityName || "N/A"}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Province/State:</span>
                                        <p className="font-medium">{currentEmployee.provinceName || "N/A"}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Department:</span>
                                        <p className="font-medium">{currentEmployee.departmentName || "N/A"}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <Separator />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* Transfer Date */}
                            <div className="space-y-2">
                                <Label>Transfer Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !transferDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {transferDate ? format(transferDate, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={transferDate}
                                            onSelect={(d) => d && setTransferDate(d)}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* New Location (Primary) */}
                            <div className="space-y-2">
                                <Label>New Location <span className="text-destructive">*</span></Label>
                                <Autocomplete
                                    options={locations.map(l => ({ value: l.id, label: l.name }))}
                                    value={newLocationId}
                                    onValueChange={setNewLocationId}
                                    placeholder="Select location"
                                    searchPlaceholder="Search location..."
                                    emptyMessage="No location found."
                                />
                            </div>

                            {/* New Province (Optional override) */}
                            <div className="space-y-2">
                                <Label>New Province/State</Label>
                                <Autocomplete
                                    options={states.map(s => ({ value: s.id, label: s.name }))}
                                    value={newStateId}
                                    onValueChange={setNewStateId}
                                    placeholder="Select province"
                                    searchPlaceholder="Search province..."
                                    emptyMessage="No province found."
                                />
                            </div>

                            {/* New City (Optional override) */}
                            <div className="space-y-2">
                                <Label>New City</Label>
                                <Autocomplete
                                    options={cities.map(c => ({ value: c.id, label: c.name }))}
                                    value={newCityId}
                                    onValueChange={setNewCityId}
                                    placeholder="Select city"
                                    searchPlaceholder="Search city..."
                                    emptyMessage="No city found."
                                    disabled={!newStateId && cities.length === 0}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Reason for Transfer</Label>
                            <Textarea
                                placeholder="Enter reason..."
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            />
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                            <Button type="submit" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Process Transfer
                            </Button>
                        </div>

                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
