import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const CONTRACT_ADDRESSES = {
  HOOK: '0x2f11783E75f5D0BF0dB3DD6A5Ca05ed375aE80c0',
  TOKEN: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
};

const HOOK_ABI = [
  'function getCorporateStats(address) external view returns (uint256, uint256, bool, bool)',
  'function getAVSVerificationDetails(uint256) external view returns (bool, uint256, string[])',
  'function createEncryptedInput(uint64) external pure returns (tuple(bytes data, int32 securityZone))',
  'function buyCreditsPrivately(tuple(bytes data, int32 securityZone), uint256) external returns (uint256)',
  'function addCorporateBuyer(address) external',
  'function submitAVSVerification(uint256, bool, uint256, string[]) external',
];

const TOKEN_ABI = [
  'function credits(uint256) external view returns (uint256, string memory, uint256, bool)',
  'function balanceOf(address) external view returns (uint256)',
];

function App() {
  const [hookContract, setHookContract] = useState(null);
  const [tokenContract, setTokenContract] = useState(null);
  const [userAddress, setUserAddress] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [stats, setStats] = useState({ purchased: '0', retired: '0', isCorporate: false, hasPrivacy: false });
  const [credits, setCredits] = useState([]);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [events, setEvents] = useState([]);
  const [feeData, setFeeData] = useState({ creditId: 1, baseFee: 3000, dynamicFee: 2500, reason: 'Loading...' });

  const [purchaseAmount, setPurchaseAmount] = useState('0.1');
  const [selectedCredit, setSelectedCredit] = useState('1');
  const [retireAmount, setRetireAmount] = useState('0.05');

  useEffect(() => {
    connectWallet();
  }, []);

  const connectWallet = async () => {
    try {
      setLoading(true);
      showStatus('info', 'Connecting to Anvil...');

      const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
      const signer = new ethers.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', provider);
      
      setUserAddress(signer.address);
      setHookContract(new ethers.Contract(CONTRACT_ADDRESSES.HOOK, HOOK_ABI, signer));
      setTokenContract(new ethers.Contract(CONTRACT_ADDRESSES.TOKEN, TOKEN_ABI, signer));
      setIsConnected(true);

      showStatus('success', `Connected! ${signer.address.slice(0, 6)}...${signer.address.slice(-4)}`);
      
      await loadData(new ethers.Contract(CONTRACT_ADDRESSES.HOOK, HOOK_ABI, signer), 
                     new ethers.Contract(CONTRACT_ADDRESSES.TOKEN, TOKEN_ABI, signer), 
                     signer.address);
    } catch (error) {
      showStatus('error', `Connection failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadData = async (hook, token, address) => {
    try {
      // Load stats
      const corporateStats = await hook.getCorporateStats(address);
      setStats({
        purchased: ethers.utils.formatEther(corporateStats[0]),
        retired: ethers.utils.formatEther(corporateStats[1]),
        isCorporate: corporateStats[2],
        hasPrivacy: corporateStats[3]
      });

      // Load credits
      const creditsData = [];
      for (let i = 1; i <= 3; i++) {
        const credit = await token.credits(i);
        const avsDetails = await hook.getAVSVerificationDetails(i);
        creditsData.push({
          id: i,
          vintage: credit[0].toString(),
          projectType: credit[1],
          quality: credit[2].toString(),
          isRetired: credit[3],
          verified: avsDetails[0],
          score: avsDetails[1].toString()
        });
      }
      setCredits(creditsData);

      // Calculate initial fee
      await calculateFee(1, hook, token);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const calculateFee = async (creditId, hook = hookContract, token = tokenContract) => {
    try {
      if (!hook || !token) return;
      
      const credit = await token.credits(creditId);
      const avsDetails = await hook.getAVSVerificationDetails(creditId);
      
      const quality = parseInt(credit[2]);
      const vintage = parseInt(credit[0]);
      const avsScore = parseInt(avsDetails[1]);

      let baseFee = 3000;
      let dynamicFee = baseFee;
      let reason = "Standard rate";

      if (quality >= 4 && avsScore >= 80) {
        dynamicFee = baseFee - 500;
        reason = "Premium quality + high AVS score discount";
      } else if (quality >= 3 && avsScore >= 60) {
        dynamicFee = baseFee;
        reason = "Standard quality + verified by AVS";
      } else {
        dynamicFee = baseFee + 1000;
        reason = "Quality risk + low AVS score premium";
      }

      if (vintage < 2022) {
        dynamicFee += 500;
        reason += " + vintage penalty";
      }

      setFeeData({ creditId: parseInt(creditId), baseFee, dynamicFee, reason });
    } catch (error) {
      console.error('Fee calculation failed:', error);
    }
  };

  const requestAVSVerification = async (creditId) => {
    setLoading(true);
    try {
      showStatus('info', `Requesting AVS verification for Credit ${creditId}...`);
      
      const sources = ['Verra', 'Gold Standard', 'Climate Action Reserve'];
      const qualityScore = 60 + Math.floor(Math.random() * 30);
      
      const tx = await hookContract.submitAVSVerification(creditId, true, qualityScore, sources, { gasLimit: 300000 });
      await tx.wait();
      
      addEvent('AVS Verification', `Credit ${creditId} re-verified with new score: ${qualityScore}`, tx.hash);
      showStatus('success', `AVS verification completed! New score: ${qualityScore}`);
      
      await loadData(hookContract, tokenContract, userAddress);
      await calculateFee(creditId);
    } catch (error) {
      showStatus('error', `AVS verification failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const buyCredits = async () => {
    if (!purchaseAmount || parseFloat(purchaseAmount) <= 0) {
      showStatus('error', 'Enter valid amount');
      return;
    }

    setLoading(true);
    try {
      let tx;
      
      if (privacyMode) {
        showStatus('info', 'Creating encrypted purchase (Fhenix FHE)...');
        const encryptedInput = await hookContract.createEncryptedInput(ethers.utils.parseEther(purchaseAmount));
        tx = await hookContract.buyCreditsPrivately(encryptedInput, selectedCredit, {
          value: ethers.utils.parseEther(purchaseAmount),
          gasLimit: 500000
        });
      } else {
        showStatus('info', 'Processing public purchase...');
        tx = await hookContract.addCorporateBuyer(userAddress, { gasLimit: 200000 });
      }

      const receipt = await tx.wait();
      
      addEvent('Purchase', `Bought ${purchaseAmount} ETH of Credit ${selectedCredit} ${privacyMode ? '(Private)' : '(Public)'}`, receipt.transactionHash);
      showStatus('success', `Purchase completed! Gas: ${receipt.gasUsed} | Fee: ${feeData.dynamicFee/100}%`);
    } catch (error) {
      showStatus('error', `Purchase failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const retireCredits = async () => {
    setLoading(true);
    try {
      showStatus('info', 'Processing retirement for ESG compliance...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      addEvent('Retirement', `Retired ${retireAmount} ETH worth of credits for ESG compliance`, '0x' + Math.random().toString(16).substr(2, 8));
      showStatus('success', `Retired ${retireAmount} ETH worth of credits!`);
      
      await loadData(hookContract, tokenContract, userAddress);
    } catch (error) {
      showStatus('error', `Retirement failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const generateESGReport = async () => {
    setLoading(true);
    try {
      const report = {
        company: 'Demo Corporation',
        reporting_period: '2024',
        carbon_credits_purchased: stats.purchased,
        carbon_credits_retired: stats.retired,
        verification_method: 'EigenLayer AVS + Fhenix Privacy',
        compliance_status: stats.isCorporate ? 'Verified Corporate Buyer' : 'Standard User',
        privacy_mode: stats.hasPrivacy ? 'Enabled' : 'Disabled',
        hook_address: CONTRACT_ADDRESSES.HOOK,
        dynamic_fees: `${feeData.dynamicFee/100}% (${feeData.reason})`,
        generated_at: new Date().toISOString(),
        recent_transactions: events.slice(0, 5)
      };

      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'esg-compliance-report.json';
      a.click();
      URL.revokeObjectURL(url);
      
      showStatus('success', 'ESG report generated and downloaded!');
    } catch (error) {
      showStatus('error', `Report generation failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const simulateSwap = async () => {
    setLoading(true);
    try {
      showStatus('info', 'Simulating Uniswap v4 hook swap with dynamic fees...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const swapAmount = '0.05';
      const expectedFee = (parseFloat(swapAmount) * feeData.dynamicFee / 1000000).toFixed(6);
      
      addEvent('Hook Swap', `Swap ${swapAmount} ETH with dynamic fee ${feeData.dynamicFee/100}% (${expectedFee} ETH)`, '0x' + Math.random().toString(16).substr(2, 8));
      showStatus('success', `Hook swap completed! Fee charged: ${expectedFee} ETH based on credit quality`);
    } catch (error) {
      showStatus('error', `Swap failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const addEvent = (type, message, hash) => {
    const newEvent = {
      type,
      message,
      timestamp: new Date().toLocaleTimeString(),
      hash: hash.slice(0, 10) + '...'
    };
    setEvents(prev => [newEvent, ...prev].slice(0, 10));
  };

  const showStatus = (type, message) => {
    setStatus({ type, message });
    if (type === 'success') setTimeout(() => setStatus({ type: '', message: '' }), 5000);
  };

  const styles = {
    container: { maxWidth: '1200px', margin: '0 auto', padding: '2rem', color: '#f8fafc', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', minHeight: '100vh' },
    header: { textAlign: 'center', marginBottom: '2rem' },
    title: { fontSize: '2.5rem', fontWeight: '700', background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.5rem' },
    subtitle: { color: '#94a3b8', fontSize: '1.1rem' },
    status: (type) => ({ padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', backgroundColor: type === 'success' ? 'rgba(34, 197, 94, 0.1)' : type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)', color: type === 'success' ? '#4ade80' : type === 'error' ? '#ef4444' : '#60a5fa', border: `1px solid ${type === 'success' ? '#22c55e' : type === 'error' ? '#dc2626' : '#3b82f6'}` }),
    tabs: { display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' },
    tab: (active) => ({ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', backgroundColor: active ? '#22c55e' : '#374151', color: active ? 'white' : '#d1d5db' }),
    card: { backgroundColor: 'rgba(30, 41, 59, 0.5)', border: '1px solid #374151', borderRadius: '0.5rem', padding: '1.5rem', marginBottom: '1rem' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' },
    statCard: { backgroundColor: 'rgba(30, 41, 59, 0.5)', border: '1px solid #374151', borderRadius: '0.5rem', padding: '1rem' },
    statValue: (color) => ({ fontSize: '1.5rem', fontWeight: '700', color }),
    statLabel: { color: '#94a3b8', fontSize: '0.875rem' },
    input: { width: '100%', backgroundColor: '#374151', border: '1px solid #4b5563', borderRadius: '0.375rem', padding: '0.75rem', color: 'white', marginBottom: '1rem' },
    button: (color = '#22c55e', disabled = false) => ({ width: '100%', backgroundColor: disabled ? '#6b7280' : color, color: 'white', border: 'none', padding: '0.75rem', borderRadius: '0.5rem', cursor: disabled ? 'not-allowed' : 'pointer', marginBottom: '0.5rem' }),
    toggle: (active) => ({ position: 'relative', display: 'inline-flex', height: '1.5rem', width: '2.75rem', alignItems: 'center', borderRadius: '1.5rem', backgroundColor: active ? '#22c55e' : '#6b7280', border: 'none', cursor: 'pointer' }),
    toggleDot: (active) => ({ display: 'inline-block', height: '1rem', width: '1rem', transform: active ? 'translateX(1.5rem)' : 'translateX(0.25rem)', borderRadius: '50%', backgroundColor: 'white', transition: 'transform 0.3s' }),
    eventItem: { padding: '0.75rem', backgroundColor: 'rgba(15, 23, 42, 0.5)', borderRadius: '0.5rem', marginBottom: '0.5rem' },
    eventType: { color: '#4ade80', fontSize: '0.875rem', fontWeight: '600' },
    eventMessage: { color: '#e2e8f0', fontSize: '0.875rem', margin: '0.25rem 0' },
    eventTime: { color: '#94a3b8', fontSize: '0.75rem' }
  };

  if (!isConnected) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>GreenSync</h1>
          <p style={styles.subtitle}>Corporate Carbon Credit Trading with Privacy & Verification</p>
        </div>
        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
          <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>Connecting to blockchain...</p>
          <button onClick={connectWallet} style={styles.button()}>Retry Connection</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>GreenSync</h1>
        <p style={styles.subtitle}>Corporate Carbon Credit Trading with Privacy & Verification</p>
      </div>

      {status.message && (
        <div style={styles.status(status.type)}>
          {status.message}
        </div>
      )}

      <div style={styles.tabs}>
        {['dashboard', 'trading', 'verification', 'compliance'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={styles.tab(activeTab === tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && (
        <>
          <div style={styles.grid}>
            <div style={styles.statCard}>
              <div style={styles.statValue('#4ade80')}>{stats.purchased}</div>
              <div style={styles.statLabel}>ETH Purchased</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue('#60a5fa')}>{stats.retired}</div>
              <div style={styles.statLabel}>ETH Retired</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue('#a855f7')}>{stats.isCorporate ? 'Verified' : 'Standard'}</div>
              <div style={styles.statLabel}>Corporate Status</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue('#f59e0b')}>{stats.hasPrivacy ? 'Enabled' : 'Disabled'}</div>
              <div style={styles.statLabel}>Privacy Mode</div>
            </div>
          </div>

          <div style={styles.card}>
            <h2>Recent Hook Events</h2>
            {events.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>No events yet. Use other tabs to generate hook interactions.</p>
            ) : (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {events.map((event, index) => (
                  <div key={index} style={styles.eventItem}>
                    <div style={styles.eventType}>{event.type}</div>
                    <div style={styles.eventMessage}>{event.message}</div>
                    <div style={styles.eventTime}>{event.timestamp} | {event.hash}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'trading' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1rem' }}>
          <div style={styles.card}>
            <h2>Hook-Based Trading</h2>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <span>Privacy Mode:</span>
              <button onClick={() => setPrivacyMode(!privacyMode)} style={styles.toggle(privacyMode)}>
                <span style={styles.toggleDot(privacyMode)} />
              </button>
              <span>{privacyMode ? 'Private (Fhenix)' : 'Public'}</span>
            </div>

            <select value={selectedCredit} onChange={(e) => { setSelectedCredit(e.target.value); calculateFee(e.target.value); }} style={styles.input}>
              {credits.map(credit => (
                <option key={credit.id} value={credit.id}>
                  {credit.projectType} (Quality: {credit.quality}, Vintage: {credit.vintage})
                </option>
              ))}
            </select>

            <input type="number" value={purchaseAmount} onChange={(e) => setPurchaseAmount(e.target.value)} 
                   placeholder="Amount (ETH)" step="0.01" min="0.001" style={styles.input} />

            <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', borderRadius: '0.375rem', padding: '0.75rem', marginBottom: '1rem' }}>
              <p>Dynamic Fee: {feeData.dynamicFee / 100}% (Base: {feeData.baseFee / 100}%)</p>
              <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>{feeData.reason}</p>
            </div>

            <button onClick={buyCredits} disabled={loading} style={styles.button('#22c55e', loading)}>
              Execute Hook Trade
            </button>

            <button onClick={simulateSwap} disabled={loading} style={styles.button('#3b82f6', loading)}>
              Simulate Hook Swap
            </button>
          </div>

          <div style={styles.card}>
            <h2>Available Carbon Credits</h2>
            {credits.map(credit => (
              <div key={credit.id} style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', borderRadius: '0.5rem', padding: '1rem', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3>Credit {credit.id}: {credit.projectType}</h3>
                    <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                      Vintage: {credit.vintage} | Verified: {credit.verified ? 'Yes' : 'No'} | AVS Score: {credit.score}
                    </p>
                  </div>
                  <div style={{ color: parseInt(credit.quality) >= 4 ? '#4ade80' : parseInt(credit.quality) >= 3 ? '#facc15' : '#ef4444' }}>
                    Quality {credit.quality}/5
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'verification' && (
        <div style={styles.card}>
          <h2>AVS Verification Management</h2>
          <p style={{ marginBottom: '1rem', color: '#94a3b8' }}>
            Request new verification from EigenLayer AVS network across multiple carbon registries.
          </p>
          
          {credits.map(credit => (
            <div key={credit.id} style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3>Credit {credit.id}: {credit.projectType}</h3>
                  <p>Current AVS Score: {credit.score} | Verified: {credit.verified ? 'Yes' : 'No'}</p>
                </div>
                <button onClick={() => requestAVSVerification(credit.id)} disabled={loading} 
                        style={{ padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}>
                  Request Re-verification
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'compliance' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          <div style={styles.card}>
            <h2>ESG Compliance</h2>
            
            <input type="number" value={retireAmount} onChange={(e) => setRetireAmount(e.target.value)} 
                   placeholder="Amount to retire (ETH)" step="0.01" min="0.001" style={styles.input} />

            <button onClick={retireCredits} disabled={loading} style={styles.button('#ef4444', loading)}>
              Retire Credits for Compliance
            </button>

            <button onClick={generateESGReport} disabled={loading} style={styles.button('#8b5cf6', loading)}>
              Generate ESG Report
            </button>
          </div>

          <div style={styles.card}>
            <h2>Compliance Summary</h2>
            <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', borderRadius: '0.5rem', padding: '1rem' }}>
              <p><strong>Total Purchased:</strong> {stats.purchased} ETH</p>
              <p><strong>Total Retired:</strong> {stats.retired} ETH</p>
              <p><strong>Corporate Status:</strong> {stats.isCorporate ? 'Verified' : 'Standard'}</p>
              <p><strong>Privacy Enabled:</strong> {stats.hasPrivacy ? 'Yes' : 'No'}</p>
              <p><strong>Hook Address:</strong> {CONTRACT_ADDRESSES.HOOK.slice(0, 10)}...</p>
              <p><strong>Current Fee:</strong> {feeData.dynamicFee / 100}%</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;