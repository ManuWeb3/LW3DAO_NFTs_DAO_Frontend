// Proper Flow f/e to b/e:
// (e.g.) F/e click (create a Proposal) -> calls createProposal() in this code -> implicitly calls createProposal(arg.)  ->
// S/C code runs -> state vars. gets updated -> we returned daoNumProposals here using contract.numProposals(); ->
// React state var gets set here using below -> use that React state var in this code itslef for further processing in f() or UI display
// another e.g. of "further processing in f()" is how numProposals is used inside fetchAllProposals()...
// made possible by using await getNumProposalsInDAO(); in createProposal()
// ==========================================================================================

import { Contract, providers } from "ethers";   // no utils this time
import { formatEther } from "ethers/lib/utils";
// utils.formatEther(wei) => string
// parses an amount in wei and outputs a decimal string that represents wei in Ether as an amount
import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import Web3Modal from "web3modal";    // used inside useEffect() React hook
import {
  CRYPTODEVS_DAO_ABI,
  CRYPTODEVS_DAO_CONTRACT_ADDRESS,
  CRYPTODEVS_NFT_ABI,
  CRYPTODEVS_NFT_CONTRACT_ADDRESS,
} from "../constants";
import styles from "../styles/Home.module.css";

export default function Home() {
  // ETH Balance of the DAO contract
  const [treasuryBalance, setTreasuryBalance] = useState("0");  // init as a string 0
  // Number of proposals created in the DAO
  const [numProposals, setNumProposals] = useState("0");        // init as a string 0
  // Array of all proposals created in the DAO
  const [proposals, setProposals] = useState([]);   // multiple proposls possible, hence []
  // User's balance of CryptoDevs NFTs
  const [nftBalance, setNftBalance] = useState(0);  // init as a number 0
  // Fake NFT Token ID to purchase. Used when creating a proposal.
  const [fakeNftTokenId, setFakeNftTokenId] = useState("");   // empty string
  // never ever this empty string value gets set as the fakeNftTokenId bcz it's the user's enetered value that gets set...
  // and proposal created

  // One of "Create Proposal" or "View Proposals"
  const [selectedTab, setSelectedTab] = useState("");         // empty string
  // True if waiting for a transaction to be mined, false otherwise.
  const [loading, setLoading] = useState(false);
  // True if user has connected their wallet, false otherwise
  const [walletConnected, setWalletConnected] = useState(false);
  // isOwner gets the owner of the contract through the signed address
  const [isOwner, setIsOwner] = useState(false);
  const web3ModalRef = useRef();

  // Helper function to connect wallet
  const connectWallet = async () => {
    try {
      await getProviderOrSigner();
      setWalletConnected(true);
    } catch (error) {
      console.error(error);
    }
  };
  
  /**
   * getOwner: gets the contract owner by connected address
   */
  const getDAOOwner = async () => {
    try {
        const signer   = await getProviderOrSigner(true);
        const contract = getDaoContractInstance(signer);
        // custom helper function made below to reduce code repetition of DAO_Address and ABI

        // call the owner function from the contract
        const _owner  = await contract.owner();
        // Get the address associated to signer which is connected to Metamask
        const address = await signer.getAddress();
        if (address.toLowerCase() === _owner.toLowerCase()) {
          setIsOwner(true);
        }
    } catch (err) {
      console.error(err.message);
    }
  };

  /**
   * withdrawCoins: withdraws ether by calling
   * the withdraw function in the contract
   */
  const withdrawDAOEther = async () => {
    try {
      const signer   = await getProviderOrSigner(true);   // wallet connected
      const contract = getDaoContractInstance(signer);    // DAO's instance returned
      
      const tx = await contract.withdrawEther();          // signer needed above for this txn
      setLoading(true);
      await tx.wait();
      setLoading(false);
      getDAOTreasuryBalance();
    } catch (err) {
      console.error(err);
      window.alert(err.reason);
    }
  };

  // Reads the ETH balance of the DAO contract and sets the `treasuryBalance` state variable
  const getDAOTreasuryBalance = async () => {
    try {
      const provider = await getProviderOrSigner();
      // provider does good here as it's only a getter
      const balance = await provider.getBalance(
        CRYPTODEVS_DAO_CONTRACT_ADDRESS
      );
      // core ethers.js f()
      // provider.getBalance(address OR "ricmoo.eth" = ENS) => Promise<BigNumber> ==== wei amount
      setTreasuryBalance(balance.toString());
      // just returning the balance won't fo any good
      // the React state var. has to be set (useState()'s very purpose, everywhere in the code)
    } catch (error) {
      console.error(error);
    }
  };

  // Reads the number of proposals in the DAO contract and sets the `numProposals` state variable
  const getNumProposalsInDAO = async () => {
    try {
      const provider = await getProviderOrSigner();
      // just getter
      const contract = getDaoContractInstance(provider);
      // contract's public state varibale, hence in-built f()
      const daoNumProposals = await contract.numProposals();
      // set React state var the moment when a proposal gets created in this code + the S/C executes
      setNumProposals(daoNumProposals.toString());  
    } catch (error) {
      console.error(error);
    }
  };

  // Reads the balance of the user's CryptoDevs NFTs and sets the `nftBalance` state variable
  const getUserNFTBalance = async () => {
    try {
      const signer = await getProviderOrSigner(true);
      const nftContract = getCryptodevsNFTContractInstance(signer);
      // input 'address' of signer (wallet connected) inside nftContract.balanceOf()
      const balance = await nftContract.balanceOf(signer.getAddress());
      // set React state var
      setNftBalance(parseInt(balance.toString()));
      // below also works in place of above, seems like 'balance' is already a number
      // setNftBalance(balance.toString());
      // bcz NFTbalance state var above is in Int, hence parseInt()
    } catch (error) {
      console.error(error);
    }
  };

  // Calls the `createProposal` function in the contract, using the tokenId from `fakeNftTokenId`
  // custom f() (without any arg) coded by us which implicitly calls...
  // daoContract.createProposal(fakeNftTokenId)
  // and takes 'fakeNftTokenId' as an input as required
  const createProposal = async () => {
    try {
      const signer = await getProviderOrSigner(true);   // setter
      const daoContract = getDaoContractInstance(signer);
      // below 'fakeNftTokenId' React State var got set bcz of the below line of code
      // onChange={(e) => setFakeNftTokenId(e.target.value)}
      // whatever user enters on the UI gets stored in (e) and fakeNftTokenId gets set to that value thru setFakeNftTokenId
      // means, never ever useState("") is assigned to the fakeNftTokenId for creation of its proposal
      const txn = await daoContract.createProposal(fakeNftTokenId);
      // 'fakeNftTokenId' is an empty string here bcz it's fake...can input any tokenId
      // actual contracts, nno specific tokenId exists
      // whatever number you pass as an arg will just be tested in available()
      // using state var-mapping (no array)...
      // hence, een if it's any random no., will simply check for address(0)
      // and mathematically, the mapping gets updated with msg.sender as owner
      // NO ACTUAL NFT TRANSFER HAPPENS EVER
      setLoading(true);
      await txn.wait();
      await getNumProposalsInDAO();
      // TODAY ONLY, I understood the purpose of calling getters without any prints
      // it sents the React State var
      setLoading(false);
    } catch (error) {
      console.error(error);
      window.alert(error.data.message);
    }
  };

  // Helper function to fetch and parse one proposal from the DAO contract
  // Given the Proposal ID
  // and converts the returned data into a Javascript object with values we can use
  const fetchProposalById = async (id) => {
    try {
      const provider = await getProviderOrSigner();
      // getter
      const daoContract = getDaoContractInstance(provider);
      // proposals is a mapping (uint256 => Proposal struct)
      // proposal below is a Proposal struct instance
      // due to this line of code in solidity => Proposal storage proposal = proposals[numProposals];
      // proposals[numProposals] is being updated with the keys->numProposals given in ascending order
      const proposal = await daoContract.proposals(id);
      // JS-Obj created here with keys as Solidity's var-identifiers and values as usual
      const parsedProposal = {
        proposalId: id,
        // all that's accessed below using (.) operator are members of struct-proposal instance
        // 'nftTokenId' (= keywords) and the likes used on the RHS of colon (:) below return values stored therein
        // same 'nftTokenId' on the LHS are the keys created with the same name
        // not sure whether LHS are (= keywords or not?)
        nftTokenId: proposal.nftTokenId.toString(),
        deadline: new Date(parseInt(proposal.deadline.toString()) * 1000),
        yayVotes: proposal.yayVotes.toString(),
        nayVotes: proposal.nayVotes.toString(),
        executed: proposal.executed,
      };
      return parsedProposal;
    } catch (error) {
      console.error(error);
    }
  };

  // Runs a loop `numProposals` times to fetch all proposals in the DAO
  // and sets the `proposals` state variable
  const fetchAllProposals = async () => {
    try {
      // below 'proposls' is different from the one created at the top as a React State var
      const proposals = [];
      // numProposals below is a React state var
      // gets set everytime when a new proposal is created on UI thru...
      // await getNumProposalsInDAO(); in createProposal() coded above
      // getNumProposalsInDAO() sets state var numProposals to be used here
      for (let i = 0; i < numProposals; i++) {
        // proposals[numProposals] is being updated with the keys->numProposals...
        // given in ascending order
        const proposal = await fetchProposalById(i);
        // that's why array created above to push returned struct Propsoal in the above line
        proposals.push(proposal);
        // .push() works bcz we're not changing React State var - array...
        // changing a usual array here LOCALLY INSIDE THIS F()... B U T... 
      }
      // here we are replacing the React state var array 'proposals' above thru below line
      // by stting it with a new array everytime bcz we cannot use .push() here
      setProposals(proposals);
      return proposals;
    } catch (error) {
      console.error(error);
    }
  };

  // Calls the `voteOnProposal` function in the contract, using the passed
  // proposal ID and Vote
  const voteOnProposal = async (proposalId, _vote) => {
    try {
      const signer = await getProviderOrSigner(true);   // setter
      const daoContract = getDaoContractInstance(signer);

      let vote = _vote === "YAY" ? 0 : 1;
      // in JS, it's 0/1 while in Solidity it's string values of enum {}
      const txn = await daoContract.voteOnProposal(proposalId, vote);
      setLoading(true);
      await txn.wait();
      setLoading(false);
      await fetchAllProposals();  // why called here?
    } catch (error) {
      console.error(error);
      window.alert(error.data.message);
    }
  };

  // Calls the `executeProposal` function in the contract, using
  // the passed proposal ID
  const executeProposal = async (proposalId) => {
    try {
      const signer = await getProviderOrSigner(true);   // setter
      const daoContract = getDaoContractInstance(signer); 
      const txn = await daoContract.executeProposal(proposalId);
      setLoading(true);
      await txn.wait();
      setLoading(false);
      await fetchAllProposals();    // why called here?
      getDAOTreasuryBalance();
      // bcz the executeProposal() uses Contract's balance (Treasury funds) to purchase() NFT
      // the updated balance should be reflected in the React State var - treasuryBalance
      // for any further processing of the treasuryBalance accurately
      // Solidity code itslef can give you hints what all to be updated upon any state-altering txn
    } catch (error) {
      console.error(error);
      window.alert(error.data.message);
    }
  };

  // Helper function to fetch a Provider/Signer instance from Metamask
  const getProviderOrSigner = async (needSigner = false) => {
    const provider = await web3ModalRef.current.connect();
    const web3Provider = new providers.Web3Provider(provider);

    const { chainId } = await web3Provider.getNetwork();
    if (chainId !== 5) {
      window.alert("Please switch to the Goerli network!");
      throw new Error("Please switch to the Goerli network");
    }

    if (needSigner) {
      const signer = web3Provider.getSigner();
      return signer;
    }
    return web3Provider;
  };

  // Helper function to return a DAO Contract instance
  // given a Provider/Signer
  const getDaoContractInstance = (providerOrSigner) => {
    return new Contract(
      CRYPTODEVS_DAO_CONTRACT_ADDRESS,
      CRYPTODEVS_DAO_ABI,
      providerOrSigner
    );
  };

  // Helper function to return a CryptoDevs NFT Contract instance
  // given a Provider/Signer as returned by getProviderOrSigner(default=false/true)
  // DRY practice
  const getCryptodevsNFTContractInstance = (providerOrSigner) => {
    return new Contract(
      // return new Contract() syntax does exist
      CRYPTODEVS_NFT_CONTRACT_ADDRESS,
      CRYPTODEVS_NFT_ABI,
      providerOrSigner
    );
  };

  // piece of code that runs everytime the value of `walletConnected` CHANGES
  // so when a wallet connects or disconnects
  // Prompts user to connect wallet if not connected
  // and then calls helper functions to fetch the
  // DAO Treasury Balance, User NFT Balance, and Number of Proposals in the DAO
  useEffect(() => {
    if (!walletConnected) {
      web3ModalRef.current = new Web3Modal({
        network: "goerli",
        providerOptions: {},
        disableInjectedProvider: false,
      });

      connectWallet().then(() => {  // passed 4 f()s that are bing called only, just another f() body defined
        getDAOTreasuryBalance();
        getUserNFTBalance();
        getNumProposalsInDAO();   // all these 3 f()s display values on the UI 
        getDAOOwner();            // if owner connected, show 3rd button of "Withdraw DAO Eth"
      });
    }
  }, [walletConnected]);

  // Piece of code that runs everytime the value of `selectedTab` changes
  // Used to re-fetch all proposals in the DAO when user switches
  // to the 'View Proposals' tab
  useEffect(() => {
    if (selectedTab === "View Proposals") {
      fetchAllProposals();
    }
  }, [selectedTab]);

  // Render the contents of the appropriate tab based on `selectedTab`
  function renderTabs() {
    if (selectedTab === "Create Proposal") {
      return renderCreateProposalTab();
    } else if (selectedTab === "View Proposals") {
      return renderViewProposalsTab();
    }
    return null;
  }

  // Renders the 'Create Proposal' tab content
  function renderCreateProposalTab() {
    // loading set to false by default
    if (loading) {
      return (
        <div className={styles.description}>
          Loading... Waiting for transaction...
        </div>
      );
      // if no NFT, then you cannot create a Proposal - msg display
    } else if (nftBalance === 0) {
      return (
        <div className={styles.description}>
          You do not own any CryptoDevs NFTs. <br />
          <b>You cannot create or vote on proposals</b>
        </div>
      );
      // if loading false, NFTs being held, then createProposal button will appear...
      // which upon click calls createProposal() with i/p as the fake-tokenId = e.target.value
    } else {
      return (
        <div className={styles.container}>
          <label>Fake NFT Token ID to Purchase: </label>
          <input
            placeholder="0"
            type="number"
            onChange={(e) => setFakeNftTokenId(e.target.value)}
          />
          <button className={styles.button2} onClick={createProposal}>
            Create
          </button>
        </div>
      );
    }
  }

  // Renders the 'View Proposals' tab content
  function renderViewProposalsTab() {
    if (loading) {
      return (
        <div className={styles.description}>
          Loading... Waiting for transaction...
        </div>
      );
      // if no proposals, display msg
    } else if (proposals.length === 0) {
      return (
        <div className={styles.description}>No proposals have been created</div>
      );
      // some proposals exist, then show to any address
      // even if an address does not own any NFTs, still it can at least view the created proposals
    } else {
      return (
        <div>
            {proposals.map((p, index) => (
            // 'p' is the struct-Proposal instance and index inside proposals array: React State var
            // "p.proposalId" and the likes below all are keys of JS-Obj: 'p' returning values to LHS labels being displayed
            <div key={index} className={styles.proposalCard}>
              <p>Proposal ID: {p.proposalId}</p>
              <p>Fake NFT to Purchase: {p.nftTokenId}</p>
              <p>Deadline: {p.deadline.toLocaleString()}</p>
              <p>Yay Votes: {p.yayVotes}</p>
              <p>Nay Votes: {p.nayVotes}</p>
              <p>Executed?: {p.executed.toString()}</p>
              {p.deadline.getTime() > Date.now() && !p.executed ? (
                // p.deadline.getTime() > Date.now() returning true means proposal is active for now
                // and open to vote + NOT(executed=default false)
                // TRUE

                // hence, give 2 options to users to vote
                // 1. Click button YAY
                // 2. Click button NAY
                // accordingly, call voteOnProposal(p.proposalId, "YAY"/"NAY")
                <div className={styles.flex}>
                  <button
                    className={styles.button2}
                    onClick={() => voteOnProposal(p.proposalId, "YAY")}
                  >
                    Vote YAY
                  </button>
                  <button
                    className={styles.button2}
                    onClick={() => voteOnProposal(p.proposalId, "NAY")}
                  >
                    Vote NAY
                  </button>
                </div>
              ) : p.deadline.getTime() < Date.now() && !p.executed ? (
                // if {p.deadline.getTime() > Date.now() && !p.executed ? = 
                // FALSE, then run below
                <div className={styles.flex}>
                  <button
                    className={styles.button2}
                    onClick={() => executeProposal(p.proposalId)}
                  >
                    Execute Proposal{" "}
                    {p.yayVotes > p.nayVotes ? "(YAY)" : "(NAY)"}
                  </button>
                </div>
              ) : (
                <div className={styles.description}>Proposal Executed</div>
              )}
            </div>
          ))}
        </div>
      );
    }
  }

  return (
    <div>
      <Head>
        <title>CryptoDevs DAO</title>
        <meta name="description" content="CryptoDevs DAO" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={styles.main}>
        <div>
          <h1 className={styles.title}>Welcome to Crypto Devs!</h1>
          <div className={styles.description}>Welcome to the DAO!</div>
          <div className={styles.description}>
            Your CryptoDevs NFT Balance: {nftBalance}
            <br />

            Treasury Balance: {formatEther(treasuryBalance)} ETH
            <br />

            Total Number of Proposals: {numProposals}
          </div>
          <div className={styles.flex}>
            <button
              className={styles.button}
              onClick={() => setSelectedTab("Create Proposal")}
            >
              Create Proposal
            </button>
            <button
              className={styles.button}
              onClick={() => setSelectedTab("View Proposals")}
            >
              View Proposals
            </button>
          </div>
          {renderTabs()}
          {/* Display additional withdraw button if connected wallet is owner using Ternary Op. below*/}
          {isOwner ? (
            <div>
            {loading ? <button className={styles.button}>Loading...</button>
                     : <button className={styles.button} onClick={withdrawDAOEther}>
                         Withdraw DAO ETH
                       </button>
            }
            </div>
            ) : ("")
          }
        </div>
        <div>
          <img className={styles.image} src="/cryptodevs/0.svg" />
        </div>
      </div>

      <footer className={styles.footer}>
        Made with &#10084; by Crypto Devs
      </footer>
    </div>
  );
}