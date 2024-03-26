import { Group } from "@semaphore-protocol/group"
import { Identity } from "@semaphore-protocol/identity"
import { generateProof } from "@semaphore-protocol/proof"
import { ethers, hardhatArguments } from "hardhat"
import { getDeployedContractAddress } from "./utils"

async function main() {
    if (!hardhatArguments.network) {
        throw Error("Please, define a supported network")
    }

    const semaphoreAddress = getDeployedContractAddress(hardhatArguments.network, "Semaphore")

    const semaphoreContract = await ethers.getContractAt("Semaphore", semaphoreAddress)

    const [admin] = await ethers.getSigners()
    const adminAddress = await admin.getAddress()

    const identity = new Identity("0")
    const members = Array.from({ length: 3 }, (_, i) => new Identity(i.toString())).map(({ commitment }) => commitment)
    const group = new Group(members)

    console.info(`Creating new group...`)

    // Create a group and add 3 members.
    const tx = await semaphoreContract["createGroup(address)"](adminAddress)

    const { logs } = (await tx.wait()) as any
    const [groupId] = logs[0].args

    console.info(`Adding ${members.length} members to group '${groupId}'...`)

    await semaphoreContract.addMembers(groupId, members)

    console.info(`Removing third member from group '${groupId}'...`)

    // Remove the third member.
    {
        group.removeMember(2)
        const { siblings } = group.generateMerkleProof(2)

        await semaphoreContract.removeMember(groupId, members[2], siblings)
    }

    console.info(`Updating second member from group '${groupId}'...`)

    // Update the second member.
    {
        group.updateMember(1, members[2])
        const { siblings } = group.generateMerkleProof(1)

        await semaphoreContract.updateMember(groupId, members[1], members[2], siblings)
    }

    console.info(`Validating a proof generated by the first member of group '${groupId}'...`)

    // Validate a proof.
    const proof = await generateProof(identity, group, 42, 9, 10)

    await semaphoreContract.validateProof(groupId, proof)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })