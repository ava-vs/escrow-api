/**
 * API Test file for Escrow API
 * 
 * This script tests all the main functionality of the Escrow API
 * deployed at https://escrow-gq9e2dbca-avas-projects-1e47760b.vercel.app/api/
 */

// Import fetch from node-fetch v3
import fetch from 'node-fetch';
import fs from 'fs/promises';

// Global types based on the API documentation
type UserType = 'CUSTOMER' | 'CONTRACTOR' | 'PLATFORM';
type OrderStatus = 'CREATED' | 'FUNDED' | 'IN_PROGRESS' | 'COMPLETED';
type MilestoneStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'PAID';
type DocumentType = 'DEFINITION_OF_READY' | 'ROADMAP' | 'DEFINITION_OF_DONE' | 'SPECIFICATION' | 'DELIVERABLE' | 'ACT_OF_WORK';
type ActStatus = 'CREATED' | 'CONTRACTOR_SIGNED' | 'COMPLETED' | 'REJECTED';

// Interface definitions based on the API responses
interface IUser {
    id: string;
    name: string;
    email: string;
    type: UserType;
    balance: number;
}

interface IMilestone {
    id: string;
    description: string;
    amount: number;
    deadline: string;
    status: MilestoneStatus;
}

interface IOrder {
    id: string;
    customerIds: string[];
    representativeId?: string;
    contractorId?: string;
    isGroupOrder: boolean;
    title: string;
    description: string;
    milestones: IMilestone[];
    status: OrderStatus;
    totalAmount: number;
    fundedAmount: number;
    createdAt: string;
}

interface IDocument {
    id: string;
    orderId: string;
    type: DocumentType;
    name: string;
    createdBy: string;
    createdAt: string;
    approvedBy?: string[];
    content: any;
}

interface IDeliverableDocument extends IDocument {
    phaseId: string;
    attachments?: string[];
}

interface IAct extends IDocument {
    type: 'ACT_OF_WORK';
    milestoneId: string;
    deliverableIds: string[];
    status: ActStatus;
    signedBy: string[];
    rejectionReason?: string;
}

interface IDoRDocument extends IDocument {
    type: 'DEFINITION_OF_READY';
}

interface IRoadmapDocument extends IDocument {
    type: 'ROADMAP';
    content: {
        phases: Array<{
            id: string;
            name: string;
            description: string;
        }>;
    };
}

interface IDoDDocument extends IDocument {
    type: 'DEFINITION_OF_DONE';
    content: {
        criteria: Array<{
            description: string;
        }>;
    };
}

// API Client class for making requests to the Escrow API
class EscrowApiClient {
    private baseUrl: string;
    private apiKey: string;
    private logFilePath: string;
    private logData: string[] = [];

    constructor(baseUrl: string, apiKey: string, logFilePath: string) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.logFilePath = logFilePath;
    }

    // Log messages with timestamp
    async log(message: string) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${message}`;
        console.log(logEntry);
        this.logData.push(logEntry);
        
        // Append to log file
        await fs.appendFile(this.logFilePath, logEntry + '\n');
    }

    // Helper method for HTTP requests
    private async request(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
        };

        // Создаем объект с типами, совместимыми с node-fetch 3.x
        const options = {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        };

        try {
            const response = await fetch(url, options);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status} - ${JSON.stringify(data)}`);
            }
            
            return data;
        } catch (error) {
            this.log(`Error making request to ${url}: ${error}`);
            throw error;
        }
    }

    // User-related API methods
    async createUser(name: string, type: UserType, email?: string, initialBalance?: number): Promise<IUser> {
        this.log(`Creating user: ${name} (${type})`);
        // Format request payload according to API expectations
        const payload = {
            name,
            email: email || `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
            type,
        };
        
        // Only include initialBalance if it's provided
        if (initialBalance !== undefined) {
            Object.assign(payload, { initialBalance });
        }
        
        return this.request('/users', 'POST', payload);
    }

    async getUser(userId: string): Promise<IUser> {
        return this.request(`/users/${userId}`);
    }

    async updateUserBalance(userId: string, amount: number): Promise<IUser> {
        this.log(`Updating user ${userId} balance by ${amount}`);
        return this.request(`/users/${userId}/balance`, 'PATCH', {
            amount
        });
    }

    // Order-related API methods
    async createOrder(
        customerId: string,
        title: string,
        description: string,
        milestones: Array<{description: string, amount: number, deadline: Date}>
    ): Promise<IOrder> {
        this.log(`Creating order: ${title} for customer ${customerId}`);
        
        // According to API docs, customerId should be a UUID
        // However, the API returns numeric IDs as strings
        // Let's try wrapping the customerId as a UUID format
        const uuidCustomerId = `00000000-0000-0000-0000-${customerId.padStart(12, '0')}`;
        
        const payload = {
            // First try with a UUID formatted string
            customerId: uuidCustomerId,
            title,
            description,
            milestones: milestones.map(m => ({
                ...m,
                amount: Number(m.amount),
                deadline: m.deadline.toISOString()
            }))
        };
        
        this.log(`Order payload: ${JSON.stringify(payload)}`);
        return this.request('/orders', 'POST', payload);
    }

    async createGroupOrder(
        customerIds: string[],
        title: string,
        description: string,
        milestones: Array<{description: string, amount: number, deadline: Date}>,
        initialRepresentativeId?: string
    ): Promise<IOrder> {
        this.log(`Creating group order: ${title} for customers ${customerIds.join(', ')}`);
        return this.request('/group-orders', 'POST', {
            customerIds,
            title,
            description,
            initialRepresentativeId,
            milestones: milestones.map(m => ({
                ...m,
                amount: Number(m.amount),
                deadline: m.deadline.toISOString()
            }))
        });
    }

    async getOrder(orderId: string): Promise<IOrder> {
        return this.request(`/orders/${orderId}`);
    }

    async getOrders(): Promise<IOrder[]> {
        return this.request('/orders');
    }

    async getUserOrders(userId: string): Promise<IOrder[]> {
        return this.request(`/users/${userId}/orders`);
    }

    async assignContractor(orderId: string, contractorId: string, assignerUserId: string): Promise<IOrder> {
        this.log(`Assigning contractor ${contractorId} to order ${orderId} by user ${assignerUserId}`);
        return this.request(`/orders/${orderId}/assign`, 'PATCH', {
            contractorId,
            assignerUserId
        });
    }

    async contributeFunds(orderId: string, contributingUserId: string, amount: number): Promise<IOrder> {
        this.log(`User ${contributingUserId} contributing ${amount} to order ${orderId}`);
        return this.request(`/orders/${orderId}/contribute`, 'POST', {
            contributingUserId,
            amount: Number(amount)
        });
    }

    async voteForRepresentative(orderId: string, voterId: string, candidateId: string): Promise<{currentRepresentativeId: string}> {
        this.log(`User ${voterId} voting for ${candidateId} as representative in order ${orderId}`);
        return this.request(`/orders/${orderId}/vote`, 'POST', {
            voterId,
            candidateId
        });
    }

    // Document-related API methods
    async createDocument(
        orderId: string,
        type: DocumentType,
        name: string,
        createdBy: string,
        content: any
    ): Promise<IDocument> {
        this.log(`Creating ${type} document: ${name} for order ${orderId}`);
        return this.request('/documents', 'POST', {
            orderId,
            type,
            name,
            createdBy,
            content
        });
    }

    async getDocument(documentId: string): Promise<IDocument> {
        return this.request(`/documents/${documentId}`);
    }

    async getOrderDocuments(orderId: string): Promise<IDocument[]> {
        return this.request(`/orders/${orderId}/documents`);
    }

    async approveDocument(documentId: string, approverId: string): Promise<IDocument> {
        this.log(`User ${approverId} approving document ${documentId}`);
        return this.request(`/documents/${documentId}/approve`, 'POST', {
            approverId
        });
    }

    // Specialized document creation methods
    async createSpecification(
        orderId: string,
        name: string,
        content: any,
        createdBy: string
    ): Promise<IDocument> {
        return this.createDocument(orderId, 'SPECIFICATION', name, createdBy, content);
    }

    async submitDeliverable(
        createdBy: string,
        orderId: string,
        phaseId: string,
        name: string,
        content: any,
        attachments?: string[]
    ): Promise<IDeliverableDocument> {
        this.log(`User ${createdBy} submitting deliverable ${name} for phase ${phaseId}`);
        const deliverableContent = {
            ...content,
            phaseId,
            attachments
        };
        return this.createDocument(orderId, 'DELIVERABLE', name, createdBy, deliverableContent) as Promise<IDeliverableDocument>;
    }

    // AI document generation - proxied through the API
    async generateDoR(orderId: string, createdBy: string): Promise<IDoRDocument> {
        this.log(`Generating DoR for order ${orderId}`);
        const name = `Definition of Ready - Order ${orderId}`;
        // In the real API, the service would generate the content
        const content = { generated: true, timestamp: new Date().toISOString() };
        return this.createDocument(orderId, 'DEFINITION_OF_READY', name, createdBy, content) as Promise<IDoRDocument>;
    }

    async generateRoadmap(orderId: string, createdBy: string): Promise<IRoadmapDocument> {
        this.log(`Generating Roadmap for order ${orderId}`);
        const order = await this.getOrder(orderId);
        
        // Create phases based on milestones
        const phases = order.milestones.map((milestone, index) => ({
            id: `phase-${index + 1}-${Date.now()}`,
            name: `Phase ${index + 1}: ${milestone.description}`,
            description: `Implementation phase for: ${milestone.description}`
        }));

        const name = `Project Roadmap - Order ${orderId}`;
        const content = { phases, generated: true, timestamp: new Date().toISOString() };
        
        return this.createDocument(orderId, 'ROADMAP', name, createdBy, content) as Promise<IRoadmapDocument>;
    }

    async generateDoD(orderId: string, createdBy: string): Promise<IDoDDocument> {
        this.log(`Generating DoD for order ${orderId}`);
        const name = `Definition of Done - Order ${orderId}`;
        
        // In the real API, this would be AI-generated based on the order details
        const criteria = [
            { description: "All specified functionality has been implemented and tested" },
            { description: "Code meets the project coding standards" },
            { description: "All critical bugs have been fixed" },
            { description: "Documentation is complete and up-to-date" }
        ];
        
        const content = { criteria, generated: true, timestamp: new Date().toISOString() };
        return this.createDocument(orderId, 'DEFINITION_OF_DONE', name, createdBy, content) as Promise<IDoDDocument>;
    }

    // Act of Work related methods
    async generateAct(
        orderId: string,
        milestoneId: string,
        deliverableIds: string[],
        createdBy: string
    ): Promise<IAct> {
        this.log(`Generating Act for milestone ${milestoneId}, order ${orderId}`);
        const milestone = (await this.getOrder(orderId)).milestones.find(m => m.id === milestoneId);
        const name = `Act of Work - ${milestone?.description || 'Milestone'} - Order ${orderId}`;
        
        return this.request('/acts', 'POST', {
            orderId,
            milestoneId,
            deliverableIds,
            createdBy,
            name
        });
    }

    async signActDocument(actId: string, userId: string): Promise<IAct> {
        this.log(`User ${userId} signing act ${actId}`);
        return this.request(`/acts/${actId}/sign`, 'POST', {
            userId
        });
    }

    async rejectActDocument(actId: string, userId: string, reason: string): Promise<IAct> {
        this.log(`User ${userId} rejecting act ${actId} with reason: ${reason}`);
        return this.request(`/acts/${actId}/reject`, 'POST', {
            userId,
            reason
        });
    }
}

// Main function to test the API
async function runApiTest() {
    // Create log file
    const logFilePath = './escrow-api-test-results.log';
    await fs.writeFile(logFilePath, `ESCROW API TEST - ${new Date().toISOString()}\n`);
    
    // Initialize API client
    const API_KEY = 'Escrow-secret-test-1'; // Правильный API ключ для авторизации
    const API_BASE_URL = 'https://escrow-gq9e2dbca-avas-projects-1e47760b.vercel.app/api';
    const api = new EscrowApiClient(API_BASE_URL, API_KEY, logFilePath);
    
    try {
        await api.log("--- STARTING API TEST ---");
        
        // --- Setup Event Listeners ---
        // Note: In this implementation, we're not using event listeners since we're directly
        // calling the API without the extra abstraction layer
        await api.log("\n--- 1. Creating Users ---");
        const customer = await api.createUser('Alice Customer', 'CUSTOMER');
        const contractor = await api.createUser('Bob Contractor', 'CONTRACTOR');
        
        await api.log(`Created Customer: ${customer.name} (ID: ${customer.id})`);
        await api.log(`Created Contractor: ${contractor.name} (ID: ${contractor.id})`);
        await api.log(`Customer object details: ${JSON.stringify(customer)}`);
        await api.log(`Contractor object details: ${JSON.stringify(contractor)}`);
        
        
        // --- Create Order ---
        await api.log("\n--- 2. Creating Order ---");
        const orderInputMilestones = [
            { description: 'Phase 1: Design & Mockups', amount: 1000, deadline: new Date('2024-09-01') },
            { description: 'Phase 2: Frontend Development', amount: 2500, deadline: new Date('2024-10-15') },
            { description: 'Phase 3: Backend & Database', amount: 3000, deadline: new Date('2024-11-30') },
            { description: 'Phase 4: Testing & Deployment', amount: 1500, deadline: new Date('2024-12-15') }
        ];
        
        let order = await api.createOrder(
            customer.id,
            'E-commerce Website Development',
            'Build a full-featured e-commerce site with product catalog, cart, and checkout.',
            orderInputMilestones
        );
        
        await api.log(`Created Order: "${order.title}" (ID: ${order.id}, Total: ${order.totalAmount})`);
        
        // --- Fund Order ---
        await api.log("\n--- 3. Funding Order ---");
        await api.log(`Depositing funds to customer ${customer.name}...`);
        const updatedCustomer = await api.updateUserBalance(customer.id, order.totalAmount + 500);
        await api.log(`Customer balance after deposit: ${updatedCustomer.balance}`);
        
        await api.log(`Funding order ${order.id} fully...`);
        order = await api.contributeFunds(order.id, customer.id, order.totalAmount);
        await api.log(`Order funded amount: ${order.fundedAmount}, Status: ${order.status}`);
        
        // --- Assign Contractor ---
        await api.log("\n--- 4. Assigning Contractor ---");
        order = await api.assignContractor(order.id, contractor.id, customer.id);
        await api.log(`Assigned contractor: ${contractor.name}, Order status: ${order.status}`);
        
        // --- AI Document Generation ---
        await api.log("\n--- 5. Generating Documents with AI ---");
        const dor = await api.generateDoR(order.id, customer.id);
        const roadmap = await api.generateRoadmap(order.id, customer.id);
        const dod = await api.generateDoD(order.id, customer.id);
        
        await api.log(`Generated DoR: ${dor.name} (ID: ${dor.id})`);
        await api.log(`Generated Roadmap: ${roadmap.name} (ID: ${roadmap.id}), Phases: ${roadmap.content.phases.length}`);
        await api.log(`Generated DoD: ${dod.name} (ID: ${dod.id}), Criteria: ${dod.content.criteria.length}`);
        
        // --- Manual Document Creation & Approval ---
        await api.log("\n--- 6. Manual Document Handling (Specification) ---");
        const specDoc = await api.createSpecification(
            order.id,
            'Initial Project Specification',
            { 
                scope: 'Homepage, Product List, Product Detail pages', 
                requirements: ['Responsive design', 'User login'], 
                details: 'More details about the spec...' 
            },
            customer.id
        );
        
        await api.log(`Created Specification: ${specDoc.name} (ID: ${specDoc.id})`);
        const approvedSpecDoc = await api.approveDocument(specDoc.id, contractor.id);
        await api.log(`Specification approved by: ${approvedSpecDoc.approvedBy?.join(', ')}`);
        
        // --- Simulate Work: Submit Deliverable for Phase 1 ---
        await api.log("\n--- 7. Submitting Deliverable for Phase 1 ---");
        const firstPhase = roadmap.content.phases[0];
        if (!firstPhase) {
            throw new Error("Could not find first phase in the generated roadmap.");
        }
        
        const deliverable1 = await api.submitDeliverable(
            contractor.id,
            order.id,
            firstPhase.id,
            'Design Mockups Package V1',
            { details: 'Complete set of Figma mockups for all main pages (Version 1).' },
            ['mockups_v1.fig', 'style_guide_v1.pdf']
        );
        
        await api.log(`Submitted Deliverable: ${deliverable1.name} (ID: ${deliverable1.id}) for Phase: ${firstPhase.id}`);
        
        // --- Create and sign Act for Phase 1 ---
        await api.log("\n--- 8. Generating and Signing Act of Work (Phase 1) ---");
        const firstMilestone = order.milestones[0];
        if (!firstMilestone) {
            throw new Error("Could not find first milestone in the order.");
        }
        
        const act1 = await api.generateAct(
            order.id,
            firstMilestone.id,
            [deliverable1.id],
            contractor.id
        );
        
        await api.log(`Generated Act: ${act1.name} (ID: ${act1.id}, Status: ${act1.status})`);
        
        // Contractor signs first
        let signedAct1 = await api.signActDocument(act1.id, contractor.id);
        await api.log(`Act status after Contractor sign: ${signedAct1.status}`);
        
        // Customer signs second
        signedAct1 = await api.signActDocument(act1.id, customer.id);
        await api.log(`Act status after Customer sign: ${signedAct1.status}`);
        
        // --- Submit Deliverable for Phase 2 ---
        await api.log("\n--- 9. Testing Deliverable for Phase 2 ---");
        const secondPhase = roadmap.content.phases[1];
        const secondMilestone = order.milestones[1];
        
        if (secondPhase && secondMilestone) {
            const deliverable2 = await api.submitDeliverable(
                contractor.id,
                order.id,
                secondPhase.id,
                'Frontend Components V1',
                { details: 'Basic Vue components structure.' },
                ['components_v1.zip']
            );
            
            await api.log(`Submitted Deliverable: ${deliverable2.name} (ID: ${deliverable2.id}) for Phase: ${secondPhase.id}`);
            
            const act2 = await api.generateAct(
                order.id,
                secondMilestone.id,
                [deliverable2.id],
                contractor.id
            );
            
            await api.log(`Generated Act: ${act2.name} (ID: ${act2.id}, Status: ${act2.status})`);
            
            // Contractor signs act
            const signedAct2 = await api.signActDocument(act2.id, contractor.id);
            await api.log(`Act status after Contractor sign: ${signedAct2.status}`);
            
            // Customer rejects the act
            const rejectedAct = await api.rejectActDocument(
                act2.id, 
                customer.id, 
                "The implementation doesn't match the requirements."
            );
            
            await api.log(`Act rejected by Customer. Status: ${rejectedAct.status}, Reason: ${rejectedAct.rejectionReason}`);
        }
        
        // --- Group Order Scenario ---
        await api.log("\n--- 10. Group Order Scenario ---");
        const custA = await api.createUser('GroupCust A', 'CUSTOMER');
        const custB = await api.createUser('GroupCust B', 'CUSTOMER');
        const custC = await api.createUser('GroupCust C', 'CUSTOMER');
        const groupContractor = await api.createUser('Group Contractor', 'CONTRACTOR');
        
        await api.log(`Created Group Customers: ${custA.name}, ${custB.name}, ${custC.name}`);
        await api.log(`Created Group Contractor: ${groupContractor.name}`);
        
        // Create group order
        const groupOrderMilestones = [
            { description: 'Group Task 1', amount: 900, deadline: new Date('2025-01-15') },
            { description: 'Group Task 2', amount: 600, deadline: new Date('2025-02-15') }
        ];
        
        let groupOrder = await api.createGroupOrder(
            [custA.id, custB.id, custC.id],
            'Collaborative Project Omega',
            'A project funded and managed by multiple customers.',
            groupOrderMilestones,
            custA.id
        );
        
        await api.log(`Created Group Order: "${groupOrder.title}" (ID: ${groupOrder.id}, Representative: ${groupOrder.representativeId})`);
        
        // Funding the group order
        const totalGroupAmount = groupOrder.totalAmount;
        const contributionPerCustomer = Math.ceil(totalGroupAmount / groupOrder.customerIds.length);
        
        await api.log(`Total Group Order amount: ${totalGroupAmount}, Per customer: ${contributionPerCustomer}`);
        
        // Deposit funds to each customer
        await api.updateUserBalance(custA.id, contributionPerCustomer + 100);
        await api.updateUserBalance(custB.id, contributionPerCustomer + 100);
        await api.updateUserBalance(custC.id, contributionPerCustomer + 100);
        
        // Each customer contributes their share
        await api.contributeFunds(groupOrder.id, custA.id, contributionPerCustomer);
        await api.log(`Customer A contributed ${contributionPerCustomer}`);
        
        await api.contributeFunds(groupOrder.id, custB.id, contributionPerCustomer);
        await api.log(`Customer B contributed ${contributionPerCustomer}`);
        
        await api.contributeFunds(groupOrder.id, custC.id, contributionPerCustomer);
        groupOrder = await api.getOrder(groupOrder.id);
        await api.log(`Customer C contributed ${contributionPerCustomer}. Final Funded Amount: ${groupOrder.fundedAmount}, Status: ${groupOrder.status}`);
        
        // Assign contractor
        groupOrder = await api.assignContractor(groupOrder.id, groupContractor.id, custA.id);
        await api.log(`Assigned group contractor: ${groupContractor.name}, Order status: ${groupOrder.status}`);
        
        // Voting for a new representative
        await api.log("\n--- 11. Voting for new representative ---");
        const voteResult = await api.voteForRepresentative(groupOrder.id, custB.id, custC.id);
        await api.log(`Vote result - Current representative: ${voteResult.currentRepresentativeId}`);
        
        // Check if representative changed
        const updatedGroupOrder = await api.getOrder(groupOrder.id);
        await api.log(`Representative after voting: ${updatedGroupOrder.representativeId}`);
        
        await api.log("\n--- API Test Completed Successfully ---");
    } catch (error: any) {
        await api.log("\n--- !!! ERROR OCCURRED !!! ---");
        await api.log(`Error Message: ${error.message}`);
        if (error.stack) {
            await api.log("Stack Trace:");
            await api.log(error.stack);
        }
    }
}

// Run the API test
runApiTest();
